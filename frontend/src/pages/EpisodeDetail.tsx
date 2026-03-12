import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2, FileText, List, ChevronDown, ChevronUp, Brain, Sparkles, Quote, Lightbulb } from 'lucide-react'
import { getEpisode, processEpisode, getTranscript, getAnalysis } from '../api/episodes'
import { getAllChats } from '../api/qa'
import ChatBar from '../components/ChatBar'
import AudioPlayer from '../components/AudioPlayer'
import TopicPicker from '../components/TopicPicker'
import type { TranscriptSegment, EpisodeSummary, ChatListItem } from '../types'

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

function formatChatTime(dateStr: string): string {
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

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TranscriptViewer({ episodeId }: { episodeId: number }) {
  const [viewMode, setViewMode] = useState<'full' | 'segments'>('segments')
  const [expanded, setExpanded] = useState(false)

  const { data: transcript, isLoading } = useQuery({
    queryKey: ['transcript', episodeId],
    queryFn: () => getTranscript(episodeId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-zinc-400 py-4">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading transcript...
      </div>
    )
  }

  if (!transcript) return null

  return (
    <div>
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-base font-bold text-zinc-900 hover:text-zinc-900/70 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Transcript
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-400 tracking-wide">
            {transcript.word_count?.toLocaleString()} words
            {transcript.language && ` \u00b7 ${transcript.language.toUpperCase()}`}
          </span>
          <div className="flex border border-zinc-200 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('segments')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] transition-colors ${viewMode === 'segments' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-50'}`}
            >
              <List className="w-3 h-3" />
              Segments
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] transition-colors ${viewMode === 'full' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-50'}`}
            >
              <FileText className="w-3 h-3" />
              Full Text
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="max-h-[600px] overflow-y-auto">
          {viewMode === 'full' ? (
            <p className="text-base text-zinc-900 leading-relaxed whitespace-pre-wrap">
              {transcript.full_text}
            </p>
          ) : (
            <div className="space-y-0.5">
              {transcript.segments.map((seg: TranscriptSegment) => (
                <div key={seg.segment_index} className="flex gap-3 py-1.5 hover:bg-[#FFFFF5] rounded px-2 -mx-2">
                  <span className="flex-shrink-0 text-[11px] font-mono text-zinc-400 pt-0.5 w-14 text-right tabular-nums">
                    {formatTimestamp(seg.start_time)}
                  </span>
                  <p className="text-base text-zinc-900 leading-relaxed">{seg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AnalysisViewer({ episodeId }: { episodeId: number }) {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['analysis', episodeId],
    queryFn: () => getAnalysis(episodeId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-zinc-400 py-4">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading analysis...
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="space-y-5">
      {/* One-line summary */}
      <div className="flex items-start gap-3 p-4 bg-zinc-900/5 rounded-lg">
        <Sparkles className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
        <p className="text-base font-medium text-zinc-900 leading-relaxed">{analysis.one_line}</p>
      </div>

      {/* Key Points */}
      {analysis.key_points.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 mb-3">
            <Lightbulb className="w-3.5 h-3.5" />
            Key Takeaways
          </h3>
          <ul className="space-y-2">
            {analysis.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-base text-zinc-900 leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-900/5 text-zinc-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Short Summary */}
      <div>
        <h3 className="text-base font-bold text-zinc-900 mb-2">Summary</h3>
        <p className="text-base text-zinc-900 leading-relaxed">{analysis.short_summary}</p>
      </div>

      {/* Detailed Summary */}
      <div>
        <h3 className="text-base font-bold text-zinc-900 mb-2">Detailed Analysis</h3>
        <div className="text-base text-zinc-900 leading-relaxed whitespace-pre-wrap">{analysis.detailed_summary}</div>
      </div>

      {/* Notable Quotes */}
      {analysis.notable_quotes.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 mb-3">
            <Quote className="w-3.5 h-3.5" />
            Notable Quotes
          </h3>
          <div className="space-y-3">
            {analysis.notable_quotes.map((q, i) => (
              <blockquote key={i} className="border-l-2 border-zinc-200 pl-4 py-1">
                <p className="text-base text-zinc-900 italic leading-relaxed">"{q.quote}"</p>
                {q.speaker && (
                  <cite className="text-[11px] text-zinc-400 not-italic mt-1 block">
                    — {q.speaker}
                  </cite>
                )}
              </blockquote>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function EpisodeDetail() {
  const { id } = useParams<{ id: string }>()
  const episodeId = Number(id)
  const queryClient = useQueryClient()

  const { data: episode, isLoading } = useQuery({
    queryKey: ['episode', episodeId],
    queryFn: () => getEpisode(episodeId),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data && (
        data.audio_status === 'downloading' ||
        data.transcription_status === 'processing' ||
        data.analysis_status === 'processing'
      )) {
        return 2000
      }
      return false
    },
  })

  const processMutation = useMutation({
    mutationFn: () => processEpisode(episodeId),
    onMutate: () => {
      queryClient.setQueryData(['episode', episodeId], (old: any) => {
        if (!old) return old
        if (old.transcription_status === 'completed' && old.analysis_status !== 'completed') {
          return { ...old, analysis_status: 'processing' }
        }
        if (old.audio_status === 'downloaded') {
          return { ...old, transcription_status: 'processing' }
        }
        return { ...old, audio_status: 'downloading' }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episode', episodeId] })
      queryClient.invalidateQueries({ queryKey: ['analysis', episodeId] })
    },
  })

  const { data: episodeChats } = useQuery({
    queryKey: ['chats', { episode_id: episodeId }],
    queryFn: () => getAllChats({ episode_id: episodeId }),
    enabled: !!episodeId,
  })

  const groupedChats = useMemo(() => (episodeChats ? groupByDate(episodeChats) : []), [episodeChats])

  if (isLoading) return <p className="text-[13px] text-zinc-400">Loading...</p>
  if (!episode) return <p className="text-[13px] text-red-500">Episode not found</p>

  const isProcessing = ['downloading'].includes(episode.audio_status) ||
    ['processing'].includes(episode.transcription_status) ||
    ['processing'].includes(episode.analysis_status)

  const canProcess =
    (episode.audio_status === 'pending' || episode.audio_status === 'failed') ||
    (episode.audio_status === 'downloaded' && (episode.transcription_status === 'pending' || episode.transcription_status === 'failed')) ||
    (episode.transcription_status === 'completed' && (episode.analysis_status === 'pending' || episode.analysis_status === 'failed'))

  return (
    <div className="pb-32">
      <h1 className="font-serif font-thin text-zinc-900 mb-2" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>{episode.title}</h1>

      {/* Podcast name */}
      {episode.podcast_title && (
        <p className="text-base text-zinc-400 mb-4">{episode.podcast_title}</p>
      )}

      {/* Metadata + Audio player */}
      <div className="flex items-center gap-4 text-[13px] text-zinc-400 mb-8">
        {episode.published_at && (
          <span className="whitespace-nowrap flex-shrink-0 leading-8">
            {new Date(episode.published_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        )}
        {episode.duration_seconds && (
          <span className="whitespace-nowrap flex-shrink-0 leading-8">{Math.round(episode.duration_seconds / 60)} min</span>
        )}
        <AudioPlayer src={episode.audio_url} durationSeconds={episode.duration_seconds} />
        <TopicPicker episodeId={episodeId} currentTopicIds={episode.topic_ids ?? []} label="Episode topic/s" size="md" />
      </div>

      {/* Add / Processing status */}
      {isProcessing && (
        <div className="mb-8 flex items-center gap-2 text-[13px] text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Processing...
        </div>
      )}
      {canProcess && !isProcessing && (
        <div className="mb-8">
          <button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {processMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : <Play className="w-4 h-4" />}
            {episode.audio_status === 'failed' || episode.transcription_status === 'failed' || episode.analysis_status === 'failed'
              ? 'Retry'
              : 'Add episode'}
          </button>
        </div>
      )}

      {/* AI Analysis – collapsible, closed by default */}
      {episode.analysis_status === 'completed' && (
        <AnalysisSection episodeId={episodeId} />
      )}

      {/* Transcript – collapsible, closed by default */}
      {episode.transcription_status === 'completed' && (
        <div className="mt-8 pt-8 border-t">
          <TranscriptViewer episodeId={episodeId} />
        </div>
      )}

      {/* Recent chats for this episode */}
      {episode.analysis_status === 'completed' && (
        <div className="mt-8 pt-8 border-t">
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
                          </div>
                          <span className="text-[13px] text-zinc-400 transition-colors group-hover:text-zinc-900 whitespace-nowrap pt-0.5">
                            {formatChatTime(chat.last_message_at)}
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
        </div>
      )}

      {/* Chat input bar */}
      {episode.analysis_status === 'completed' && (
        <ChatBar episodeId={episodeId} placeholder="Ask about this episode" showMessages={false} />
      )}
    </div>
  )
}

function AnalysisSection({ episodeId }: { episodeId: number }) {
  return (
    <div className="mt-8">
      <AnalysisViewer episodeId={episodeId} />
    </div>
  )
}
