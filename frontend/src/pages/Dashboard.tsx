import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Rss, ChevronRight, Plus, Trash2, RefreshCw } from 'lucide-react'
import { getPodcasts, refreshStalePodcasts, refreshAllPodcasts, unfollowPodcast } from '../api/podcasts'
import { getEpisodes, trashEpisode } from '../api/episodes'
import StatusBadge from '../components/StatusBadge'
import TopicPicker from '../components/TopicPicker'
import ChatBar from '../components/ChatBar'
import AddPodcastModal from '../components/AddPodcastModal'
import AddEpisodeModal from '../components/AddEpisodeModal'
import InsightsTimeline from '../components/InsightsTimeline'

function stripEmoji(text: string) {
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
}

function isFullyProcessed(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'downloaded' && episode.transcription_status === 'completed' && episode.analysis_status === 'completed'
}

function isPending(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'pending' && episode.transcription_status === 'pending' && episode.analysis_status === 'pending'
}

const greetings = [
  'Hey genius', 'Hello brilliant', 'Welcome back', 'Missed you', 'Hey smarty',
  "You're unstoppable", 'Hello superstar', 'Ready, champion', 'Hey scholar',
  "You're incredible", 'Welcome, legend', 'Hey rockstar', "You're amazing",
  'Hello wonder', "You're crushing it", 'Hey brainiac', "You're thriving",
  'Hello explorer', "You're spectacular", 'Hey curious', "You're shining",
  'Welcome, friend', "You're phenomenal", 'Hey learner', "You're radiant",
  'Hello seeker', "You've got this", 'Hey thinker', "You're glowing",
  'Welcome, wise one', "You're limitless", 'Hello dreamer',
]

export default function Dashboard() {
  const [addEpisode, setAddEpisode] = useState<{ id: number; title: string } | null>(null)
  const [visibleCount, setVisibleCount] = useState(5)
  const [showAddPodcast, setShowAddPodcast] = useState(false)
  const queryClient = useQueryClient()

  const greeting = useMemo(() => greetings[Math.floor(Math.random() * greetings.length)], [])

  // Refresh stale feeds (not checked in 24h) on page load
  useEffect(() => {
    refreshStalePodcasts().then((result) => {
      if (result.new_episodes > 0) {
        queryClient.invalidateQueries({ queryKey: ['episodes'] })
        queryClient.invalidateQueries({ queryKey: ['podcasts'] })
      }
    }).catch(() => {})
  }, [])

  const { data: podcasts, isLoading: loadingPodcasts } = useQuery({
    queryKey: ['podcasts'],
    queryFn: () => getPodcasts(),
  })

  const { data: recentEpisodes, isLoading: loadingEpisodes } = useQuery({
    queryKey: ['episodes', 'recent'],
    queryFn: () => getEpisodes({ limit: 50 }),
  })

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])

  const newEpisodes = useMemo(() =>
    recentEpisodes?.filter((ep) => {
      if (!ep.published_at) return false
      if (new Date(ep.published_at) < thirtyDaysAgo) return false
      return ep.analysis_status !== 'completed'
    }),
    [recentEpisodes, thirtyDaysAgo]
  )

  const trashMutation = useMutation({
    mutationFn: (episodeId: number) => trashEpisode(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: (podcastId: number) => unfollowPodcast(podcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podcasts'] })
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })

  const refreshAllMutation = useMutation({
    mutationFn: () => refreshAllPodcasts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      queryClient.invalidateQueries({ queryKey: ['podcasts'] })
    },
  })

  return (
    <div>
      <h1 className="font-serif font-thin text-zinc-900 mb-1" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>{greeting}</h1>
      <p className="text-[20px] text-zinc-400 mb-8 leading-relaxed">
        Study your favorite podcasts. Get summaries, ask questions, retain what matters to you.
      </p>

      {/* Ask anything */}
      <div className="mb-8">
        <ChatBar />
      </div>

      {/* New Insights */}
      <section className="mb-10">
        <InsightsTimeline />
      </section>

      {/* New Episodes */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-zinc-800">Add episodes to dig into</h2>
          <button
            onClick={() => refreshAllMutation.mutate()}
            disabled={refreshAllMutation.isPending}
            className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-900 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {loadingEpisodes ? (
          <p className="text-[13px] text-zinc-400">Loading...</p>
        ) : !newEpisodes?.length ? (
          <p className="text-[13px] text-zinc-400">No new episodes to process.</p>
        ) : (
          <>
            <div className="border divide-y">
              {newEpisodes.slice(0, visibleCount).map((episode) => (
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
                    {isFullyProcessed(episode) && (
                      <TopicPicker
                        episodeId={episode.id}
                        currentTopicIds={episode.topic_ids ?? []}
                      />
                    )}
                    {!isFullyProcessed(episode) && (
                      isPending(episode) ? (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddEpisode({ id: episode.id, title: episode.title }) }}
                          className="text-[11px] font-medium text-zinc-400 px-2.5 py-0.5 hover:bg-zinc-900 hover:text-white transition-colors"
                        >
                          Add episode
                        </button>
                      ) : (
                        <StatusBadge status={episode.audio_status} type="audio" />
                      )
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
            {newEpisodes.length > visibleCount && (
              <div className="mt-3 text-center">
                <button
                  onClick={() => setVisibleCount((c) => c + 5)}
                  className="text-[13px] text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  View more
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Podcasts */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-zinc-800">Podcasts you're following</h2>
          <button
            onClick={() => setShowAddPodcast(true)}
            className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Podcast
          </button>
        </div>
        {loadingPodcasts ? (
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
      </section>

      {/* Add Podcast modal */}
      {showAddPodcast && (
        <AddPodcastModal onClose={() => setShowAddPodcast(false)} />
      )}

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
