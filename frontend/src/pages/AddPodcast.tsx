import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Rss, Plus, Loader2 } from 'lucide-react'
import { getTopics, createTopic } from '../api/topics'
import { addPodcast } from '../api/podcasts'

export default function AddPodcast() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [feedUrl, setFeedUrl] = useState('')
  const [topicId, setTopicId] = useState<number | ''>('')
  const [newTopicName, setNewTopicName] = useState('')
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: topics } = useQuery({ queryKey: ['topics'], queryFn: getTopics })

  const addMutation = useMutation({
    mutationFn: addPodcast,
    onSuccess: (podcast) => {
      queryClient.invalidateQueries({ queryKey: ['podcasts'] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      navigate(`/podcasts/${podcast.id}`)
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to add podcast')
    },
  })

  const createTopicMutation = useMutation({
    mutationFn: createTopic,
    onSuccess: (topic) => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      setTopicId(topic.id)
      setNewTopicName('')
      setShowNewTopic(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!feedUrl.trim()) {
      setError('Please enter a feed URL')
      return
    }
    if (topicId === '') {
      setError('Please select a topic')
      return
    }

    addMutation.mutate({ feed_url: feedUrl.trim(), topic_id: topicId as number })
  }

  const handleCreateTopic = () => {
    if (!newTopicName.trim()) return
    createTopicMutation.mutate({ name: newTopicName.trim() })
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Podcast</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        {/* Feed URL */}
        <div>
          <label htmlFor="feedUrl" className="block text-sm font-medium text-gray-700 mb-1">
            RSS Feed URL
          </label>
          <div className="relative">
            <Rss className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="feedUrl"
              type="url"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-podcast-primary/50 focus:border-podcast-primary outline-none text-sm"
            />
          </div>
        </div>

        {/* Topic selection */}
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
            Topic
          </label>
          {!showNewTopic ? (
            <div className="flex gap-2">
              <select
                id="topic"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : '')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-podcast-primary/50 focus:border-podcast-primary outline-none text-sm"
              >
                <option value="">Select a topic...</option>
                {topics?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewTopic(true)}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="e.g. Politics, Vibe Coding, Design"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-podcast-primary/50 focus:border-podcast-primary outline-none text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={handleCreateTopic}
                disabled={createTopicMutation.isPending}
                className="px-3 py-2 bg-podcast-primary text-white rounded-lg text-sm font-medium hover:bg-podcast-primary/90 disabled:opacity-50 transition-colors"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => { setShowNewTopic(false); setNewTopicName('') }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={addMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-podcast-primary text-white rounded-lg font-medium hover:bg-podcast-primary/90 disabled:opacity-50 transition-colors"
        >
          {addMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing Feed...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add Podcast
            </>
          )}
        </button>

        <p className="text-xs text-gray-500">
          The 5 most recent episodes will be automatically downloaded and queued for processing.
        </p>
      </form>
    </div>
  )
}
