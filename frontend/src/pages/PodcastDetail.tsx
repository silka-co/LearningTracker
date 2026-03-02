import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Clock, ChevronRight, Play, Loader2 } from 'lucide-react'
import { getPodcast, refreshPodcast } from '../api/podcasts'
import { getEpisodes, processEpisode } from '../api/episodes'
import StatusBadge from '../components/StatusBadge'

export default function PodcastDetail() {
  const { id } = useParams<{ id: string }>()
  const podcastId = Number(id)
  const queryClient = useQueryClient()

  const { data: podcast, isLoading } = useQuery({
    queryKey: ['podcast', podcastId],
    queryFn: () => getPodcast(podcastId),
  })

  const { data: episodes } = useQuery({
    queryKey: ['episodes', podcastId],
    queryFn: () => getEpisodes({ podcast_id: podcastId, limit: 100 }),
    refetchInterval: 5000, // Poll for status updates
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshPodcast(podcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podcast', podcastId] })
      queryClient.invalidateQueries({ queryKey: ['episodes', podcastId] })
    },
  })

  const processMutation = useMutation({
    mutationFn: processEpisode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes', podcastId] })
    },
  })

  if (isLoading) return <p className="text-gray-500">Loading...</p>
  if (!podcast) return <p className="text-red-500">Podcast not found</p>

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        {podcast.image_url ? (
          <img src={podcast.image_url} alt="" className="w-20 h-20 rounded-xl object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-podcast-primary/10 flex items-center justify-center">
            <span className="text-2xl">🎙️</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{podcast.title}</h1>
          {podcast.author && <p className="text-gray-500">{podcast.author}</p>}
          {podcast.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{podcast.description}</p>
          )}
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Episodes */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Episodes ({episodes?.length ?? 0})
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {episodes?.map((episode) => (
          <div key={episode.id} className="flex items-center gap-4 px-4 py-3">
            <Link
              to={`/episodes/${episode.id}`}
              className="min-w-0 flex-1 hover:text-podcast-primary transition-colors"
            >
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {episode.title}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                {episode.published_at && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(episode.published_at).toLocaleDateString()}
                  </span>
                )}
                {episode.duration_seconds && (
                  <span className="text-xs text-gray-400">
                    {Math.round(episode.duration_seconds / 60)}m
                  </span>
                )}
              </div>
            </Link>

            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={episode.audio_status} type="audio" />
              {episode.audio_status === 'pending' && (
                <button
                  onClick={() => processMutation.mutate(episode.id)}
                  disabled={processMutation.isPending}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-podcast-primary text-white rounded font-medium hover:bg-podcast-primary/90 disabled:opacity-50 transition-colors"
                >
                  {processMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  Process
                </button>
              )}
              <Link to={`/episodes/${episode.id}`}>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
