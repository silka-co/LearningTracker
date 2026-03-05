import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { getEpisodes, processEpisode, trashEpisode } from '../api/episodes'
import StatusBadge from '../components/StatusBadge'
import TopicPicker from '../components/TopicPicker'
import ChatBar from '../components/ChatBar'

function stripEmoji(text: string) {
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
}

function isFullyProcessed(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'downloaded' && episode.transcription_status === 'completed' && episode.analysis_status === 'completed'
}

function isPending(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'pending' && episode.transcription_status === 'pending' && episode.analysis_status === 'pending'
}

export default function AllTopics() {
  const [confirmEpisodeId, setConfirmEpisodeId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const { data: episodes, isLoading } = useQuery({
    queryKey: ['episodes', 'has_topic'],
    queryFn: () => getEpisodes({ has_topic: true, limit: 200 }),
  })

  const processMutation = useMutation({
    mutationFn: (episodeId: number) => processEpisode(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      setConfirmEpisodeId(null)
    },
  })

  const trashMutation = useMutation({
    mutationFn: (episodeId: number) => trashEpisode(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })

  return (
    <div>
      <h1 className="font-serif font-thin text-zinc-900 mb-8" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>
        All Topics
      </h1>

      {/* Chat */}
      <div className="mb-8">
        <ChatBar />
      </div>

      {/* Episodes with any topic */}
      <section>
        {isLoading ? (
          <p className="text-zinc-400 text-sm">Loading...</p>
        ) : !episodes?.length ? (
          <p className="text-zinc-400 text-sm">No episodes have been assigned to a topic yet.</p>
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
                  {!isFullyProcessed(episode) && (
                    isPending(episode) ? (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmEpisodeId(episode.id) }}
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

      {/* Confirmation modal */}
      {confirmEpisodeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmEpisodeId(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Analyse this episode?</h3>
            <p className="text-[13px] text-zinc-500 mb-5">This will download, transcribe, and analyse the audio. It may take a few minutes.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmEpisodeId(null)}
                className="px-3 py-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => processMutation.mutate(confirmEpisodeId)}
                disabled={processMutation.isPending}
                className="px-3 py-1.5 text-[13px] font-medium text-white bg-zinc-900 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {processMutation.isPending ? 'Starting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
