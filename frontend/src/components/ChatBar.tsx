import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowUp, ArrowDown, CornerDownRight, Loader2, MessageSquare } from 'lucide-react'
import {
  sendEpisodeMessage,
  getEpisodeChatHistory,
  sendDashboardMessage,
  getDashboardChatHistory,
  sendTopicMessage,
  getTopicChatHistory,
} from '../api/qa'
import type { QAMessageResponse } from '../types'

interface ChatBarProps {
  /** Episode ID for episode-level chat. */
  episodeId?: number
  /** Topic ID for topic-level chat. */
  topicId?: number
  /** Custom placeholder text for the input field. */
  placeholder?: string
  /** Whether to show the message list above the input. Defaults to true. */
  showMessages?: boolean
}

export default function ChatBar({ episodeId, topicId, placeholder, showMessages = true }: ChatBarProps) {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const chatKey = episodeId
    ? ['chat', 'episode', episodeId]
    : topicId
      ? ['chat', 'topic', topicId]
      : ['chat', 'dashboard']

  // Track scroll position of main content area
  const checkScroll = useCallback(() => {
    const main = document.querySelector('main')
    if (!main) return
    const threshold = 100
    const isAtBottom = main.scrollHeight - main.scrollTop - main.clientHeight < threshold
    setShowScrollBtn(!isAtBottom)
  }, [])

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    checkScroll()
    main.addEventListener('scroll', checkScroll, { passive: true })
    // Also check on resize
    window.addEventListener('resize', checkScroll)

    return () => {
      main.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const scrollToBottom = () => {
    const main = document.querySelector('main')
    if (main) {
      main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' })
    }
  }

  // Fetch existing chat history
  const { data: session } = useQuery({
    queryKey: chatKey,
    queryFn: () =>
      episodeId
        ? getEpisodeChatHistory(episodeId)
        : topicId
          ? getTopicChatHistory(topicId)
          : getDashboardChatHistory(),
  })

  const messages = session?.messages ?? []

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      episodeId
        ? sendEpisodeMessage(episodeId, content)
        : topicId
          ? sendTopicMessage(topicId, content)
          : sendDashboardMessage(content),
    onMutate: async (content) => {
      // Optimistic update: add user message immediately
      await queryClient.cancelQueries({ queryKey: chatKey })
      const prev = queryClient.getQueryData(chatKey)

      queryClient.setQueryData(chatKey, (old: any) => {
        const optimisticMsg: QAMessageResponse = {
          id: -Date.now(),
          role: 'user',
          content,
          follow_up_questions: null,
          created_at: new Date().toISOString(),
        }
        if (!old) {
          return { id: 0, episode_id: episodeId ?? null, topic_id: topicId ?? null, title: null, created_at: new Date().toISOString(), messages: [optimisticMsg] }
        }
        return { ...old, messages: [...old.messages, optimisticMsg] }
      })

      return { prev }
    },
    onSuccess: (assistantMsg) => {
      // Add the real assistant response
      queryClient.setQueryData(chatKey, (old: any) => {
        if (!old) return old
        return { ...old, messages: [...old.messages, assistantMsg] }
      })
      // Refresh chat detail pages and sidebar recents
      queryClient.invalidateQueries({ queryKey: ['chat-detail'] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      // Navigate to the chat when messages aren't shown inline
      if (!showMessages && assistantMsg.session_id) {
        navigate(`/chats/${assistantMsg.session_id}`)
      }
    },
    onError: (_err, _content, context) => {
      // Roll back on error
      if (context?.prev) {
        queryClient.setQueryData(chatKey, context.prev)
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sendMutation.isPending) return

    setInput('')
    sendMutation.mutate(content)
  }

  const handleFollowUp = (question: string) => {
    if (sendMutation.isPending) return
    sendMutation.mutate(question)
  }

  // Get the most recent message timestamp for the chat date
  const lastMessageDate = messages.length > 0
    ? new Date(messages[messages.length - 1].created_at)
    : null

  // Get follow-up questions from the last assistant message
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const followUps = lastAssistantMsg?.follow_up_questions ?? []

  return (
    <div>
      {showMessages && (
        <>
          {/* Chat heading */}
          {messages.length > 0 && (
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
                <MessageSquare className="w-4 h-4 text-zinc-400" />
                AI Chat
              </h2>
              {lastMessageDate && (
                <p className="text-[11px] text-zinc-400 mt-1 ml-6">
                  {lastMessageDate.toLocaleDateString()} at {lastMessageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}

          {/* Messages rendered inline */}
          {messages.length > 0 && (
            <div className="space-y-4 mb-6">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === 'user' ? (
                    <p className="text-base font-medium text-zinc-900">{msg.content}</p>
                  ) : (
                    <div className="prose prose-base prose-zinc max-w-none [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {sendMutation.isPending && (
                <div className="text-base text-zinc-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          )}

          {/* Thinking indicator when no messages yet */}
          {messages.length === 0 && sendMutation.isPending && (
            <div className="mb-6 text-base text-zinc-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking...
            </div>
          )}
        </>
      )}

      {/* Follow-up questions – in content flow, aligned with content above */}
      {followUps.length > 0 && !sendMutation.isPending && (
        <div className="mt-10 mb-5">
          <p className="text-base font-semibold text-zinc-900 mb-2">Follow-up questions</p>
          {followUps.map((q, i) => (
            <button
              key={i}
              onClick={() => handleFollowUp(q)}
              className="w-full flex items-center gap-3 py-2.5 text-left text-[15px] text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <CornerDownRight className="w-4 h-4 flex-shrink-0 text-zinc-300" />
              <span className="truncate">{q}</span>
            </button>
          ))}
        </div>
      )}

      {/* Fixed input bar at bottom of content area */}
      <div className="fixed bottom-0 left-60 right-0 z-10">
        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <div className="flex justify-center mb-0">
            <button
              onClick={scrollToBottom}
              className="p-3.5 rounded-full border border-zinc-300 shadow-lg text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 transition-colors"
              style={{ backgroundColor: '#FFFFF5' }}
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="pointer-events-none h-8 bg-gradient-to-t from-[#FFFFE6] to-transparent" />
        <div className="px-8 pb-6" style={{ backgroundColor: '#FFFFE6' }}>
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2 border border-zinc-300 rounded-full px-5 py-3 shadow-md hover:border-zinc-900 focus-within:border-zinc-900 transition-colors" style={{ backgroundColor: '#FFFFF5' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={placeholder ?? (episodeId ? "Ask anything about this episode" : topicId ? "Ask about this topic" : "Ask anything")}
                  className="flex-1 bg-transparent text-base text-zinc-800 placeholder-zinc-400 outline-none"
                  disabled={sendMutation.isPending}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sendMutation.isPending}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
