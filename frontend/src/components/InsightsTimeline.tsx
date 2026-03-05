import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { getInsights } from '../api/episodes'
import { getAllChats } from '../api/qa'
import { getTopics } from '../api/topics'
import type { InsightItem, ChatListItem } from '../types'

type TimelineItem =
  | { kind: 'insight'; data: InsightItem }
  | { kind: 'chat'; data: ChatListItem }

function stripEmoji(text: string) {
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
}

function formatDateColumn(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'long' }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

function toLocalDateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function InsightsTimeline() {
  // filter: '' = all, 'chats' = chats only, or a numeric topic ID as string
  const [filter, setFilter] = useState('')
  const [visibleDates, setVisibleDates] = useState(3)

  const isChatsOnly = filter === 'chats'
  const selectedTopicId = filter && !isChatsOnly ? Number(filter) : null

  const insightsParams = selectedTopicId != null
    ? { topic_id: selectedTopicId, limit: 50 }
    : { days: 90, limit: 50 }

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['insights', selectedTopicId],
    queryFn: () => getInsights(insightsParams),
    enabled: !isChatsOnly,
  })

  const chatsParams = selectedTopicId != null
    ? { topic_id: selectedTopicId }
    : undefined

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ['chats', selectedTopicId],
    queryFn: () => getAllChats(chatsParams),
  })

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: getTopics,
  })

  const isLoading = isChatsOnly ? chatsLoading : (insightsLoading || chatsLoading)

  const grouped = useMemo(() => {
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const groups = new Map<string, TimelineItem[]>()
    groups.set(todayKey, [])

    // Add insights (skip when chats-only filter)
    if (!isChatsOnly) {
      for (const item of (insights ?? [])) {
        const key = item.published_at ? toLocalDateKey(item.published_at) : todayKey
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push({ kind: 'insight', data: item })
      }
    }

    // Add chats
    for (const chat of (chats ?? [])) {
      const key = toLocalDateKey(chat.last_message_at)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push({ kind: 'chat', data: chat })
    }

    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [insights, chats, isChatsOnly])

  const hasTopics = topics && topics.length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-zinc-800">New Insights</h2>
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setVisibleDates(3) }}
          className="text-[13px] text-zinc-400 bg-transparent border-none outline-none cursor-pointer hover:text-zinc-900 transition-colors"
        >
          <option value="">All topics & chats</option>
          <option value="chats">Chats</option>
          {topics?.map((topic) => (
            <option key={topic.id} value={topic.id}>{topic.name}</option>
          ))}
        </select>
      </div>
      {isLoading ? (
        <p className="text-[13px] text-zinc-400">Loading...</p>
      ) : (isChatsOnly ? !chats?.length : !insights?.length && !chats?.length) ? (
        <p className="text-[13px] text-zinc-400">
          {isChatsOnly ? 'No chats yet.' : selectedTopicId != null ? 'No insights for this topic yet.' : 'Analyze an episode to see insights here.'}
        </p>
      ) : (
      <>
        <div className="divide-y border-b">
          {grouped.slice(0, visibleDates).map(([dateKey, items]) => {
            const { day, month, weekday } = formatDateColumn(dateKey)
            return (
              <div key={dateKey} className="flex">
                {/* Date column */}
                <div className="w-[100px] flex-shrink-0 border-r pr-4 py-4">
                  <span className="text-2xl font-light text-zinc-900 leading-none">{day}</span>
                  <div className="text-[13px] text-zinc-400 mt-0.5">{month}</div>
                  <div className="text-[13px] text-zinc-400">{weekday}</div>
                </div>

                {/* Items column */}
                <div className="flex-1 min-w-0 flex flex-col">
                  {items.length === 0 ? (
                    <p className="text-[13px] text-zinc-400 pl-5 py-4 flex-1">No new insights today</p>
                  ) : (
                    <div className="divide-y flex-1 flex flex-col [&>a]:flex-1">
                      {items.map((item) =>
                        item.kind === 'insight' ? (
                          <Link
                            key={`insight-${item.data.episode_id}`}
                            to={`/episodes/${item.data.episode_id}`}
                            className="block pl-5 pr-4 py-4 hover:bg-zinc-900/5 transition-colors"
                          >
                            {item.data.topics.length > 0 && (
                              <p className="text-[13px] font-medium text-zinc-400 mb-1.5">
                                {(selectedTopicId != null
                                  ? item.data.topics.find((t) => t.id === selectedTopicId)?.name
                                  : item.data.topics[0].name) ?? item.data.topics[0].name}
                                {' '}episode
                              </p>
                            )}
                            <p className="text-base text-zinc-600 leading-relaxed line-clamp-3 mb-1.5">
                              {item.data.short_summary}
                            </p>
                            {item.data.podcast_title && (
                              <span className="text-[13px] text-zinc-400">
                                {stripEmoji(item.data.podcast_title)}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <Link
                            key={`chat-${item.data.id}`}
                            to={`/chats/${item.data.id}`}
                            className="block pl-5 pr-4 py-4 hover:bg-zinc-900/5 transition-colors"
                          >
                            <p className="text-[13px] font-medium text-zinc-400 mb-1.5">
                              Chat in{' '}
                              {item.data.context_type === 'topic' && item.data.topic_name
                                ? item.data.topic_name
                                : item.data.context_type === 'episode' && item.data.episode_title
                                  ? (item.data.episode_title.length > 30 ? item.data.episode_title.slice(0, 30) + '...' : item.data.episode_title)
                                  : 'All episodes'}
                            </p>
                            <p className="text-base text-zinc-600 leading-relaxed line-clamp-3">
                              {item.data.first_question}
                            </p>
                          </Link>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {grouped.length > visibleDates && (
          <div className="text-center mt-3">
            <button
              onClick={() => setVisibleDates((v) => v + 3)}
              className="text-[13px] text-zinc-400 hover:text-zinc-900 transition-colors"
            >
              See more
            </button>
          </div>
        )}
      </>
      )}
    </div>
  )
}
