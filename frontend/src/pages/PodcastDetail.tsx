import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Loader2, Trash2 } from 'lucide-react'
import { getPodcast, refreshPodcast } from '../api/podcasts'
import { getEpisodes, trashEpisode } from '../api/episodes'
import StatusBadge from '../components/StatusBadge'
import TopicPicker from '../components/TopicPicker'
import AddEpisodeModal from '../components/AddEpisodeModal'

function isFullyProcessed(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'downloaded' && episode.transcription_status === 'completed' && episode.analysis_status === 'completed'
}

function isPending(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'pending' && episode.transcription_status === 'pending' && episode.analysis_status === 'pending'
}

export default function PodcastDetail() {
  const { id } = useParams<{ id: string }>()
  const podcastId = Number(id)
  const [addEpisode, setAddEpisode] = useState<{ id: number; title: string } | null>(null)
  const queryClient = useQueryClient()

  const { data: podcast, isLoading } = useQuery({
    queryKey: ['podcast', podcastId],
    queryFn: () => getPodcast(podcastId),
  })

  const { data: episodes } = useQuery({
    queryKey: ['episodes', podcastId],
    queryFn: () => getEpisodes({ podcast_id: podcastId, limit: 200 }),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.some((e: any) => e.audio_status === 'downloading')) {
        return 2000
      }
      return 10000
    },
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshPodcast(podcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podcast', podcastId] })
      queryClient.invalidateQueries({ queryKey: ['episodes', podcastId] })
    },
  })

  const trashMutation = useMutation({
    mutationFn: (episodeId: number) => trashEpisode(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })

  if (isLoading) return <p className="text-zinc-400 text-sm">Loading...</p>
  if (!podcast) return <p className="text-red-500 text-sm">Podcast not found</p>

  const downloadingCount = episodes?.filter((e: any) => e.audio_status === 'downloading').length ?? 0

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif font-thin text-zinc-900 mb-8" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>{podcast.title}</h1>
        {podcast.author && <p className="text-zinc-400 text-base mt-0.5">{podcast.author}</p>}
        {podcast.description && (
          <p className="text-base text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{podcast.description}</p>
        )}
      </div>

      {/* Active downloads banner */}
      {downloadingCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 mb-5 border border-zinc-300">
          <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
          <p className="text-xs text-zinc-900">
            Downloading {downloadingCount} episode{downloadingCount > 1 ? 's' : ''}... This page updates automatically.
          </p>
        </div>
      )}

      {/* Episodes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-zinc-800">
            Episodes ({episodes?.length ?? 0})
          </h2>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-900 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {!episodes?.length ? (
          <p className="text-zinc-400 text-sm">No episodes yet.</p>
        ) : (
          <div className="border divide-y">
            {episodes.map((episode) => (
              <Link
                key={episode.id}
                to={`/episodes/${episode.id}`}
                className="flex items-start gap-4 px-4 py-3 transition-all group hover:outline hover:outline-1 hover:outline-zinc-900 hover:-outline-offset-1"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-medium text-zinc-900 transition-colors truncate">
                    {episode.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {episode.published_at && (
                      <p className="text-[11px] text-zinc-400 group-hover:text-zinc-900 transition-colors">
                        {new Date(episode.published_at).toLocaleDateString()}
                      </p>
                    )}
                    {episode.duration_seconds && (
                      <p className="text-[11px] text-zinc-400 group-hover:text-zinc-900 transition-colors">
                        {Math.round(episode.duration_seconds / 60)}m
                      </p>
                    )}
                  </div>
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
