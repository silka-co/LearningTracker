import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Sparkles } from 'lucide-react'
import { getTopics, createTopic } from '../api/topics'
import { getEpisode, suggestTopic, processEpisode, toggleEpisodeTopic } from '../api/episodes'

const TOPIC_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
]

interface AddEpisodeModalProps {
  episodeId: number
  episodeTitle: string
  onClose: () => void
}

export default function AddEpisodeModal({ episodeId, episodeTitle, onClose }: AddEpisodeModalProps) {
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [suggestedNewName, setSuggestedNewName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: topics } = useQuery({ queryKey: ['topics'], queryFn: getTopics })

  const { data: episode } = useQuery({
    queryKey: ['episode', episodeId],
    queryFn: () => getEpisode(episodeId),
  })

  const { data: suggestion, isLoading: loadingSuggestion } = useQuery({
    queryKey: ['episode-suggest-topic', episodeId],
    queryFn: () => suggestTopic(episodeId),
  })

  // Pre-select topics already assigned to the episode
  useEffect(() => {
    if (episode?.topic_ids?.length) {
      setSelectedTopicIds(episode.topic_ids)
    }
  }, [episode])

  // Pre-select the suggested topic when it loads
  useEffect(() => {
    if (!suggestion) return
    if (suggestion.match === 'existing' && suggestion.topic_id != null) {
      setSelectedTopicIds((prev) => prev.includes(suggestion.topic_id!) ? prev : [...prev, suggestion.topic_id!])
    } else if (suggestion.match === 'suggested' && suggestion.topic_name) {
      setSuggestedNewName(suggestion.topic_name)
    }
  }, [suggestion])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (isAddingNew && inputRef.current) inputRef.current.focus()
  }, [isAddingNew])

  const createMutation = useMutation({
    mutationFn: (name: string) => {
      const color = TOPIC_COLORS[Math.floor(Math.random() * TOPIC_COLORS.length)]
      return createTopic({ name, color })
    },
    onSuccess: (newTopic) => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      setSelectedTopicIds((prev) => [...prev, newTopic.id])
      setSuggestedNewName(null)
      setIsAddingNew(false)
      setNewTopicName('')
    },
  })

  const processMutation = useMutation({
    mutationFn: async () => {
      // Only add topics that aren't already assigned (avoid toggling off)
      const currentTopicIds = new Set(episode?.topic_ids ?? [])
      for (const topicId of selectedTopicIds) {
        if (!currentTopicIds.has(topicId)) {
          await toggleEpisodeTopic(episodeId, topicId)
        }
      }
      return processEpisode(episodeId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      queryClient.invalidateQueries({ queryKey: ['episode', episodeId] })
      onClose()
    },
  })

  const toggleTopic = (id: number) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  const handleCreateNew = () => {
    const name = newTopicName.trim()
    if (name) createMutation.mutate(name)
  }

  const handleAcceptSuggestion = () => {
    if (suggestedNewName) {
      createMutation.mutate(suggestedNewName)
    }
  }

  const handleStartAddNew = () => {
    setNewTopicName(suggestedNewName || '')
    setSuggestedNewName(null)
    setIsAddingNew(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="rounded-lg shadow-xl p-6 w-[380px] mx-4"
        style={{ backgroundColor: '#FFFFE6' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 mb-2">Pick a topic for this episode</h3>
        <p className="text-base text-zinc-900 mb-1">{episodeTitle}</p>
        {episode?.description && (
          <p className="text-[13px] text-zinc-900 mb-4 line-clamp-2">{episode.description.replace(/<[^>]*>/g, '').split(/[.!?]\s/)[0]}.</p>
        )}
        {!episode?.description && <div className="mb-4" />}

        {/* Topic selection */}
        <div className="mb-4">

          {/* Suggested new topic banner */}
          {suggestedNewName && (
            <button
              onClick={handleAcceptSuggestion}
              disabled={createMutation.isPending}
              className="w-full text-left px-3 py-2.5 mb-2 rounded-md border border-dashed border-zinc-300 flex items-center gap-2 text-sm hover:border-zinc-400 transition-colors group"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-zinc-500 group-hover:text-zinc-900 transition-colors">
                Create "<span className="font-medium text-zinc-900">{suggestedNewName}</span>"
              </span>
              <span className="ml-auto text-[10px] text-zinc-400">suggested</span>
            </button>
          )}

          {loadingSuggestion ? (
            <p className="text-[12px] text-zinc-400 mb-2">Finding best topic...</p>
          ) : null}

          <div className="max-h-[200px] overflow-y-auto border rounded-md divide-y divide-zinc-100">
            {topics?.map((topic) => {
              const isSelected = selectedTopicIds.includes(topic.id)
              return (
                <button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors text-zinc-900 hover:bg-zinc-50"
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

            {/* Add new topic inline */}
            {isAddingNew ? (
              <div className="px-3 py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNew()
                    if (e.key === 'Escape') { setIsAddingNew(false); setNewTopicName('') }
                  }}
                  placeholder="Topic name"
                  className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  style={{ backgroundColor: '#FFFFF5' }}
                  disabled={createMutation.isPending}
                />
              </div>
            ) : (
              <button
                onClick={handleStartAddNew}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New topic
              </button>
            )}
          </div>
        </div>

        <p className="text-[13px] text-zinc-400 mb-4">
          This will download, transcribe, and analyse the audio. It may take a few minutes.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => processMutation.mutate()}
            disabled={selectedTopicIds.length === 0 || processMutation.isPending}
            className="px-3 py-1.5 text-[13px] font-medium text-white bg-zinc-900 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {processMutation.isPending ? 'Starting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
