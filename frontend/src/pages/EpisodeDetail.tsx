import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2, Clock, ExternalLink } from 'lucide-react'
import { getEpisode, processEpisode } from '../api/episodes'
import StatusBadge from '../components/StatusBadge'

export default function EpisodeDetail() {
  const { id } = useParams<{ id: string }>()
  const episodeId = Number(id)
  const queryClient = useQueryClient()

  const { data: episode, isLoading } = useQuery({
    queryKey: ['episode', episodeId],
    queryFn: () => getEpisode(episodeId),
    refetchInterval: (query) => {
      // Poll while processing
      const data = query.state.data
      if (data && (data.audio_status === 'downloading' || data.transcription_status === 'processing' || data.analysis_status === 'processing')) {
        return 3000
      }
      return false
    },
  })

  const processMutation = useMutation({
    mutationFn: () => processEpisode(episodeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['episode', episodeId] }),
  })

  if (isLoading) return <p className="text-gray-500">Loading...</p>
  if (!episode) return <p className="text-red-500">Episode not found</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{episode.title}</h1>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
        {episode.published_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {new Date(episode.published_at).toLocaleDateString()}
          </span>
        )}
        {episode.duration_seconds && (
          <span>{Math.round(episode.duration_seconds / 60)} min</span>
        )}
        <a
          href={episode.audio_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-podcast-primary hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Audio
        </a>
      </div>

      {/* Processing Pipeline Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Processing Pipeline</h2>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24">Audio</span>
            <StatusBadge status={episode.audio_status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24">Transcription</span>
            <StatusBadge status={episode.transcription_status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24">Analysis</span>
            <StatusBadge status={episode.analysis_status} />
          </div>
        </div>

        {episode.error_message && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {episode.error_message}
          </div>
        )}

        {(episode.audio_status === 'pending' || episode.audio_status === 'failed') && (
          <button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-podcast-primary text-white rounded-lg text-sm font-medium hover:bg-podcast-primary/90 disabled:opacity-50 transition-colors"
          >
            {processMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {episode.audio_status === 'failed' ? 'Retry Processing' : 'Start Processing'}
          </button>
        )}
      </div>

      {/* Description */}
      {episode.description && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Description</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{episode.description}</p>
        </div>
      )}

      {/* Placeholder for future sections */}
      {episode.transcription_status === 'completed' && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Transcript</h2>
          <p className="text-sm text-gray-500 italic">Transcript viewer coming in Phase 2...</p>
        </div>
      )}

      {episode.analysis_status === 'completed' && (
        <div className="mt-6 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Summary</h2>
            <p className="text-sm text-gray-500 italic">AI summary coming in Phase 3...</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Q&A / Quiz</h2>
            <p className="text-sm text-gray-500 italic">Q&A and quiz features coming in Phase 3...</p>
          </div>
        </div>
      )}
    </div>
  )
}
