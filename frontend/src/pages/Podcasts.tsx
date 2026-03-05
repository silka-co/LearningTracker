import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Rss, ChevronRight, Plus } from 'lucide-react'
import { getPodcasts, unfollowPodcast } from '../api/podcasts'
import AddPodcastModal from '../components/AddPodcastModal'

function stripEmoji(text: string) {
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
}

export default function Podcasts() {
  const [showAddPodcast, setShowAddPodcast] = useState(false)
  const queryClient = useQueryClient()

  const { data: podcasts, isLoading } = useQuery({
    queryKey: ['podcasts'],
    queryFn: () => getPodcasts(),
  })

  const unfollowMutation = useMutation({
    mutationFn: (podcastId: number) => unfollowPodcast(podcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podcasts'] })
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })

  return (
    <div>
      <h1 className="font-serif font-thin text-zinc-900 mb-8" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>
        Podcasts for you
      </h1>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-zinc-800">Following</h2>
        <button
          onClick={() => setShowAddPodcast(true)}
          className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-900 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Podcast
        </button>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-zinc-400">Loading...</p>
      ) : !podcasts?.length ? (
        <div className="py-10 text-center">
          <Rss className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-[13px] text-zinc-400 mb-3">No podcasts yet</p>
          <button
            onClick={() => setShowAddPodcast(true)}
            className="inline-flex items-center gap-1 text-zinc-900 hover:text-zinc-600 font-medium text-sm underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-500 transition-colors"
          >
            Add your first podcast
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 border [&>*]:border-b [&>*:last-child]:border-b-0 md:[&>*:nth-last-child(2):nth-child(odd)]:border-b-0 md:[&>*:nth-child(odd)]:border-r">
          {podcasts.map((podcast) => (
            <Link
              key={podcast.id}
              to={`/podcasts/${podcast.id}`}
              className="group relative p-4 hover:outline hover:outline-1 hover:outline-zinc-900 hover:-outline-offset-1 transition-all"
            >
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); unfollowMutation.mutate(podcast.id) }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[11px] text-zinc-400 hover:text-zinc-900 transition-all"
              >
                Unfollow
              </button>
              <div className="flex items-start gap-3">
                {podcast.image_url ? (
                  <img
                    src={podcast.image_url}
                    alt=""
                    className="w-11 h-11 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 bg-zinc-100 flex items-center justify-center flex-shrink-0">
                    <Rss className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-zinc-900 text-base transition-colors truncate">{stripEmoji(podcast.title)}</h3>
                  {podcast.author && (
                    <p className="text-[11px] text-zinc-400 group-hover:text-zinc-900 truncate mt-0.5 transition-colors">{podcast.author}</p>
                  )}
                  <p className="text-[11px] text-zinc-400 group-hover:text-zinc-900 mt-1.5 tracking-wide transition-colors">
                    {podcast.episode_count}/{podcast.total_episode_count} episodes added
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Suggested podcasts */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-800 mb-4">Suggested podcasts</h2>
        <p className="text-base text-zinc-400">Coming soon.</p>
      </section>

      {/* Add Podcast modal */}
      {showAddPodcast && (
        <AddPodcastModal onClose={() => setShowAddPodcast(false)} />
      )}
    </div>
  )
}
