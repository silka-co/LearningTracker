import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Rss, Plus, Loader2 } from 'lucide-react'
import { addPodcast } from '../api/podcasts'

export default function AddPodcast() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [feedUrl, setFeedUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: addPodcast,
    onSuccess: (podcast) => {
      queryClient.invalidateQueries({ queryKey: ['podcasts'] })
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      navigate(`/podcasts/${podcast.id}`)
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to add podcast')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!feedUrl.trim()) {
      setError('Please enter a feed URL')
      return
    }

    addMutation.mutate({ feed_url: feedUrl.trim() })
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-serif font-thin text-zinc-900 mb-8" style={{ fontSize: '67px', letterSpacing: '-2.7px', lineHeight: 1.05 }}>Add Podcast</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Feed URL */}
        <div>
          <label htmlFor="feedUrl" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
            RSS Feed URL
          </label>
          <div className="relative">
            <Rss className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
            <input
              id="feedUrl"
              type="url"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 outline-none text-sm text-zinc-900 placeholder:text-zinc-300 bg-transparent transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 border border-red-300 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={addMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
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

        <p className="text-[11px] text-zinc-400 tracking-wide">
          The 5 most recent episodes will be automatically downloaded and queued for processing.
        </p>
      </form>
    </div>
  )
}
