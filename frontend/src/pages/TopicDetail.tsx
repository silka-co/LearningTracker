import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { getTopics } from '../api/topics'
import { getEpisodes, processEpisode, trashEpisode } from '../api/episodes'
import { getAllChats } from '../api/qa'
import StatusBadge from '../components/StatusBadge'
import TopicPicker from '../components/TopicPicker'
import ChatBar from '../components/ChatBar'
import type { ChatListItem } from '../types'

function stripEmoji(text: string) {
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((today.getTime() - dateDay.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function groupByDate(chats: ChatListItem[]): { label: string; chats: ChatListItem[] }[] {
  const groups = new Map<string, ChatListItem[]>()
  for (const chat of chats) {
    const key = dateKey(chat.last_message_at)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(chat)
  }
  return Array.from(groups.entries()).map(([, chats]) => ({
    label: formatDateLabel(chats[0].last_message_at),
    chats,
  }))
}

function isFullyProcessed(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'downloaded' && episode.transcription_status === 'completed' && episode.analysis_status === 'completed'
}

function isPending(episode: { audio_status: string; transcription_status: string; analysis_status: string }) {
  return episode.audio_status === 'pending' && episode.transcription_status === 'pending' && episode.analysis_status === 'pending'
}

export default function TopicDetail() {
  const { id } = useParams<{ id: string }>()
  const topicId = Number(id)
  const [confirmEpisodeId, setConfirmEpisodeId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: getTopics,
  })

  const topic = topics?.find((t) => t.id === topicId)

  const { data: episodes, isLoading } = useQuery({
    queryKey: ['episodes', 'topic', topicId],
    queryFn: () => getEpisodes({ topic_id: topicId, limit: 200 }),
    enabled: !!topicId,
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

  const { data: topicChats } = useQuery({
    queryKey: ['chats', { topic_id: topicId }],
    queryFn: () => getAllChats({ topic_id: topicId }),
    enabled: !!topicId,
  })

  const groupedChats = useMemo(() => (topicChats ? groupByDate(topicChats) : []), [topicChats])

  if (!topic) {
    return <p className="text-[13px] text-zinc-400">Topic not found</p>
  }

  return (
    <div className="pb-32">
      <h1 className="font-serif font-thin text-zinc-900 mb-8" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>
        {topic.name}
      </h1>

      {/* Episodes in this topic */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-zinc-800 mb-3">
          Episodes about {topic.name}
        </h2>
        {isLoading ? (
          <p className="text-[13px] text-zinc-400">Loading...</p>
        ) : !episodes?.length ? (
          <p className="text-[13px] text-zinc-400">No episodes in this topic yet.</p>
        ) : (
          <div className={`border divide-y ${(episodes.length > 5) ? 'max-h-[340px] overflow-y-auto' : ''}`}>
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

      {/* Recent chats */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-800 mb-3">
          Recent chats
        </h2>
        {groupedChats.length > 0 ? (
          <div className="space-y-6">
            {groupedChats.map((group) => (
              <div key={group.label}>
                <p className="text-[13px] text-zinc-400 mb-2">{group.label}</p>
                <div className="pl-4">
                  {group.chats.map((chat) => (
                    <div
                      key={chat.id}
                      className="group border-b border-zinc-200 transition-colors hover:border-zinc-900"
                    >
                      <div className="flex items-start justify-between gap-4 py-3">
                        <div className="min-w-0 flex-1">
                          <Link to={`/chats/${chat.id}`}>
                            <p className="text-base font-medium text-zinc-900 leading-snug mb-0.5">
                              {chat.first_question}
                            </p>
                          </Link>
                          <p className="text-[13px] text-zinc-400">
                            {chat.context_type === 'episode' && chat.episode_id && chat.episode_title && (
                              <>
                                Asked in{' '}
                                <Link
                                  to={`/episodes/${chat.episode_id}`}
                                  className="underline decoration-zinc-300 hover:decoration-zinc-900 hover:text-zinc-900 transition-colors"
                                >
                                  {chat.episode_title}
                                </Link>
                              </>
                            )}
                            {chat.context_type === 'topic' && (
                              <span>Asked in {topic.name}</span>
                            )}
                          </p>
                        </div>
                        <span className="text-[13px] text-zinc-400 transition-colors group-hover:text-zinc-900 whitespace-nowrap pt-0.5">
                          {formatTime(chat.last_message_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-zinc-400">No chats yet. Ask a question below to get started.</p>
        )}
      </section>

      {/* Chat input bar */}
      <ChatBar topicId={topicId} placeholder={`Ask about ${topic.name}`} showMessages={false} />

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
