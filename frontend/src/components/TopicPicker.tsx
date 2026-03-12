import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Check, Plus } from 'lucide-react'
import { getTopics, createTopic } from '../api/topics'
import { toggleEpisodeTopic } from '../api/episodes'

const TOPIC_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
]

interface TopicPickerProps {
  episodeId: number
  currentTopicIds: number[]
  label?: string
  size?: 'sm' | 'md'
}

export default function TopicPicker({ episodeId, currentTopicIds, label = 'Topics', size = 'sm' }: TopicPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: getTopics,
  })

  const toggleMutation = useMutation({
    mutationFn: (topicId: number) => toggleEpisodeTopic(episodeId, topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      queryClient.invalidateQueries({ queryKey: ['episode', episodeId] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => {
      const color = TOPIC_COLORS[Math.floor(Math.random() * TOPIC_COLORS.length)]
      return createTopic({ name, color })
    },
    onSuccess: (newTopic) => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      toggleMutation.mutate(newTopic.id)
    },
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsAdding(false)
        setNewName('')
      }
    }
    if (isOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  const handleCreateSubmit = () => {
    const trimmed = newName.trim()
    if (trimmed) {
      createMutation.mutate(trimmed)
    }
    setIsAdding(false)
    setNewName('')
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => { setIsOpen(false); setIsAdding(false); setNewName('') }}
    >
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`flex items-center gap-1.5 ${size === 'md' ? 'text-[13px] leading-8' : 'text-[11px]'} text-zinc-400 hover:text-zinc-900 transition-colors px-2 py-1 whitespace-nowrap`}
      >
        <span>{label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full w-48 pt-1 z-50">
        <div
          className="border rounded-lg shadow-lg py-1"
          style={{ backgroundColor: '#FFFFE6' }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        >
          {/* Topic list */}
          {topics?.map((topic) => {
            const isSelected = currentTopicIds.includes(topic.id)
            return (
              <button
                key={topic.id}
                onClick={() => toggleMutation.mutate(topic.id)}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors text-zinc-900 hover:bg-zinc-900/5"
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-zinc-900 text-white' : 'border border-zinc-300'
                }`}>
                  {isSelected && <Check className="w-3 h-3" />}
                </span>
                {topic.name}
              </button>
            )
          })}

          {/* Divider */}
          <div className="border-t my-1" />

          {/* Add topic */}
          {isAdding ? (
            <div className="px-3 py-1.5">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubmit()
                  if (e.key === 'Escape') { setIsAdding(false); setNewName('') }
                }}
                onBlur={handleCreateSubmit}
                placeholder="Topic name"
                className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-zinc-900"
                style={{ backgroundColor: '#FFFFF5' }}
                disabled={createMutation.isPending}
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-900/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add topic
            </button>
          )}
        </div>
        </div>
      )}
    </div>
  )
}
