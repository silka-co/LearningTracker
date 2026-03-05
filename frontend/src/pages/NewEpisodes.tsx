import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { getEpisodes, trashEpisode } from '../api/episodes'
import StatusBadge from '../components/StatusBadge'
import TopicPicker from '../components/TopicPicker'
import AddEpisodeModal from '../components/AddEpisodeModal'

function stripEmoji(text: string) {
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
}

function isPending(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'pending' && episode.transcription_status === 'pending' && episode.analysis_status === 'pending'
}

function isFullyProcessed(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'downloaded' && episode.transcription_status === 'completed' && episode.analysis_status === 'completed'
}

export default function NewEpisodes() {
  const [addEpisode, setAddEpisode] = useState<{ id: number; title: string } | null>(null)
  const queryClient = useQueryClient()

  const { data: episodes, isLoading } = useQuery({
    queryKey: ['episodes', 'all'],
    queryFn: () => getEpisodes({ limit: 200 }),
  })

  const trashMutation = useMutation({
    mutationFn: (episodeId: number) => trashEpisode(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])

  // Unprocessed episodes from the last 30 days
  const newEpisodes = useMemo(() =>
    episodes?.filter((ep) => {
      if (!ep.published_at) return false
      if (new Date(ep.published_at) < thirtyDaysAgo) return false
      return ep.analysis_status !== 'completed'
    }),
    [episodes, thirtyDaysAgo]
  )

  // Completed episodes from the last 30 days
  const recentlyAdded = useMemo(() =>
    episodes?.filter((ep) => {
      if (!ep.published_at) return false
      if (new Date(ep.published_at) < thirtyDaysAgo) return false
      return ep.analysis_status === 'completed'
    }),
    [episodes, thirtyDaysAgo]
  )

  return (
    <div>
      <h1 className="font-serif font-thin text-zinc-900 mb-2" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>
        New Episodes
      </h1>
      <p className="text-base text-zinc-400 mb-8">
        Recent episodes from the last 30 days.
        {' '}<Link to="/episodes" className="text-zinc-900 hover:underline">View all episodes</Link>
      </p>

      {/* New episodes to add */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-zinc-800 mb-4">New episodes to add</h2>
        {isLoading ? (
          <p className="text-zinc-400 text-sm">Loading...</p>
        ) : !newEpisodes?.length ? (
          <p className="text-zinc-400 text-sm">All caught up! No new episodes to process.</p>
        ) : (
          <div className="border divide-y">
            {newEpisodes.map((episode) => (
              <Link
                key={episode.id}
                to={`/episodes/${episode.id}`}
                className="flex items-start gap-4 px-4 py-3 transition-all group hover:outline hover:outline-1 hover:outline-zinc-900 hover:-outline-offset-1"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-medium text-zinc-900 transition-colors truncate">
                    {episode.title}
                  </h3>
                  {episode.podcast_title && (
                    <p className="text-[11px] text-zinc-400 group-hover:text-zinc-900 transition-colors truncate mt-1">
                      {stripEmoji(episode.podcast_title)}
                    </p>
                  )}
                  {episode.published_at && (
                    <p className="text-[11px] text-zinc-400 group-hover:text-zinc-900 transition-colors mt-0.5">
                      {new Date(episode.published_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {isPending(episode) ? (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddEpisode({ id: episode.id, title: episode.title }) }}
                      className="text-[11px] font-medium text-zinc-400 px-2.5 py-0.5 hover:bg-zinc-900 hover:text-white transition-colors"
                    >
                      Add episode
                    </button>
                  ) : (
                    <StatusBadge status={episode.audio_status} type="audio" />
                  )}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); trashMutation.mutate(episode.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-zinc-900 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Episodes recently added */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-zinc-800 mb-4">Episodes recently added</h2>
        {isLoading ? (
          <p className="text-zinc-400 text-sm">Loading...</p>
        ) : !recentlyAdded?.length ? (
          <p className="text-zinc-400 text-sm">No episodes added yet.</p>
        ) : (
          <div className="border divide-y">
            {recentlyAdded.map((episode) => (
              <Link
                key={episode.id}
                to={`/episodes/${episode.id}`}
                className="flex items-start gap-4 px-4 py-3 transition-all group hover:outline hover:outline-1 hover:outline-zinc-900 hover:-outline-offset-1"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-medium text-zinc-900 transition-colors truncate">
                    {episode.title}
                  </h3>
                  {episode.podcast_title && (
                    <p className="text-[11px] text-zinc-400 group-hover:text-zinc-900 transition-colors truncate mt-1">
                      {stripEmoji(episode.podcast_title)}
                    </p>
                  )}
                  {episode.published_at && (
                    <p className="text-[11px] text-zinc-400 group-hover:text-zinc-900 transition-colors mt-0.5">
                      {new Date(episode.published_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <TopicPicker
                    episodeId={episode.id}
                    currentTopicIds={episode.topic_ids ?? []}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {addEpisode && (
        <AddEpisodeModal
          episodeId={addEpisode.id}
          episodeTitle={addEpisode.title}
          onClose={() => setAddEpisode(null)}
        />
      )}
    </div>
  )
}
