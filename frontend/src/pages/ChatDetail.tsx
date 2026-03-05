import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, Clipboard, Check, Layers } from 'lucide-react'
import { getChatDetail } from '../api/qa'
import ChatBar from '../components/ChatBar'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleCopy}
        className="group/copy relative p-1.5 text-zinc-300 hover:text-zinc-600 transition-colors"
        aria-label="Copy"
      >
        {copied ? (
          <Check className="w-4 h-4 text-zinc-600" />
        ) : (
          <Clipboard className="w-4 h-4" />
        )}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 text-[14px] text-white bg-zinc-800 rounded whitespace-nowrap opacity-0 pointer-events-none group-hover/copy:opacity-100 transition-opacity">
          {copied ? 'Copied' : 'Copy'}
        </span>
      </button>
    </div>
  )
}

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>()
  const sessionId = Number(id)

  const { data: chat, isLoading } = useQuery({
    queryKey: ['chat-detail', sessionId],
    queryFn: () => getChatDetail(sessionId),
    enabled: !!sessionId,
  })

  if (isLoading) {
    return <p className="text-[13px] text-zinc-400">Loading...</p>
  }

  if (!chat) {
    return <p className="text-[13px] text-zinc-400">Chat not found.</p>
  }

  // Build the source link
  let sourceLink: string | null = null
  let sourceLabel: string | null = null

  if (chat.context_type === 'episode' && chat.episode_id) {
    sourceLink = `/episodes/${chat.episode_id}`
    sourceLabel = chat.episode_title || 'Episode'
  } else if (chat.context_type === 'topic' && chat.topic_id) {
    sourceLink = `/topics/${chat.topic_id}`
    sourceLabel = chat.topic_name || 'Topic'
  }

  // Context description for non-linked contexts
  const contextDesc = chat.context_type === 'dashboard' ? 'All episodes' : ''

  // Heading text: "Topic Name Chat", "Episode Chat", or just "Chat"
  const heading = chat.topic_name
    ? `${chat.topic_name} chat`
    : chat.episode_title
      ? 'Episode chat'
      : 'Chat'

  // Chat input placeholder
  const chatPlaceholder = chat.episode_title
    ? 'Ask about this episode'
    : chat.topic_name
      ? `Ask about ${chat.topic_name}`
      : 'Ask anything'

  return (
    <div className="pb-32">
      {/* Back link */}
      <Link
        to="/chats"
        className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to chats
      </Link>

      {/* Large serif heading */}
      <h1 className="font-serif font-thin text-zinc-900 mb-8" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>
        {heading}
      </h1>

      {/* Meta */}
      <div className="mb-8">
        {/* Source link */}
        {sourceLink && sourceLabel && (
          <p className="text-base text-zinc-900">
            Source:{' '}
            <Link
              to={sourceLink}
              className="text-zinc-900 underline decoration-zinc-300 hover:decoration-zinc-900 transition-colors"
            >
              {sourceLabel}
            </Link>
          </p>
        )}
        {!sourceLink && contextDesc && (
          <p className="text-base text-zinc-400">Source: {contextDesc}</p>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-6">
        {chat.messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div>
                <p className="text-[13px] text-zinc-400 mb-2 text-right">
                  {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {' at '}
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex justify-end">
                  <div className="bg-zinc-800 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                    <p className="text-base">{msg.content}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="prose prose-base prose-zinc max-w-none [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <CopyButton text={msg.content} />
                  {sourceLink && chat.source_episode_count > 0 && (
                    <Link
                      to={sourceLink}
                      className="inline-flex items-center gap-1.5 px-1.5 py-1.5 text-zinc-300 hover:text-zinc-600 transition-colors"
                    >
                      <Layers className="w-4 h-4" />
                      <span className="text-[13px]">{chat.source_episode_count} {chat.source_episode_count === 1 ? 'source' : 'sources'}</span>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chat input bar */}
      <ChatBar
        episodeId={chat.episode_id ?? undefined}
        topicId={chat.topic_id ?? undefined}
        placeholder={chatPlaceholder}
        showMessages={false}
      />
    </div>
  )
}
