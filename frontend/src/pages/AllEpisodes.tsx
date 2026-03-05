import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trash2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { getEpisodes, trashEpisode, restoreEpisode } from '../api/episodes'
import StatusBadge from '../components/StatusBadge'
import TopicPicker from '../components/TopicPicker'
import AddEpisodeModal from '../components/AddEpisodeModal'

function stripEmoji(text: string) {
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
}

function isFullyProcessed(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'downloaded' && episode.transcription_status === 'completed' && episode.analysis_status === 'completed'
}

function isPending(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'pending' && episode.transcription_status === 'pending' && episode.analysis_status === 'pending'
}

export default function AllEpisodes() {
  const [addEpisode, setAddEpisode] = useState<{ id: number; title: string } | null>(null)
  const [showTrashed, setShowTrashed] = useState(false)
  const queryClient = useQueryClient()

  const { data: episodes, isLoading } = useQuery({
    queryKey: ['episodes', 'all'],
    queryFn: () => getEpisodes({ limit: 200 }),
  })

  const { data: trashedEpisodes } = useQuery({
    queryKey: ['episodes', 'trashed'],
    queryFn: () => getEpisodes({ trashed: true, limit: 50 }),
  })

  const trashMutation = useMutation({
    mutationFn: (episodeId: number) => trashEpisode(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (episodeId: number) => restoreEpisode(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })

  return (
    <div>
      <h1 className="font-serif font-thin text-zinc-900 mb-8" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>
        All Episodes
      </h1>

      {isLoading ? (
        <p className="text-zinc-400 text-sm">Loading...</p>
      ) : !episodes?.length ? (
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
      )}

      {/* Trashed Episodes */}
      {trashedEpisodes && trashedEpisodes.length > 0 && (
        <section className="mt-10">
          <button
            onClick={() => setShowTrashed(!showTrashed)}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            {showTrashed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Trashed ({trashedEpisodes.length})
          </button>
          {showTrashed && (
            <div className="border divide-y mt-3">
              {trashedEpisodes.map((episode) => (
                <div
                  key={episode.id}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm text-zinc-400 truncate">{episode.title}</h3>
                    {episode.podcast_title && (
                      <span className="text-[11px] text-zinc-300 truncate">{stripEmoji(episode.podcast_title)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => restoreMutation.mutate(episode.id)}
                    className="text-[11px] font-medium text-zinc-400 px-2.5 py-0.5 hover:bg-zinc-900 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
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
