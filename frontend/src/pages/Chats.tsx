import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { getAllChats } from '../api/qa'
import type { ChatListItem } from '../types'

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

export default function Chats() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const { data: chats, isLoading } = useQuery({
    queryKey: ['chats', search],
    queryFn: () => getAllChats(search ? { search } : undefined),
  })

  const grouped = useMemo(() => (chats ? groupByDate(chats) : []), [chats])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-800">
          Chats
        </h1>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-zinc-900 rounded-md hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search your chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
          style={{ backgroundColor: '#FFFFF5' }}
        />
      </div>

      {/* Chat list */}
      {isLoading ? (
        <p className="text-[13px] text-zinc-400">Loading...</p>
      ) : !chats?.length ? (
        <p className="text-[13px] text-zinc-400">
          {search
            ? 'No chats match your search.'
            : 'No chats yet. Start a conversation on any episode or topic.'}
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
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
                          {chat.context_type === 'topic' && chat.topic_id && chat.topic_name && (
                            <>
                              Asked in{' '}
                              <Link
                                to={`/topics/${chat.topic_id}`}
                                className="underline decoration-zinc-300 hover:decoration-zinc-900 hover:text-zinc-900 transition-colors"
                              >
                                {chat.topic_name}
                              </Link>
                            </>
                          )}
                          {chat.context_type === 'dashboard' && (
                            <span>Asked in All episodes</span>
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
      )}
    </div>
  )
}
