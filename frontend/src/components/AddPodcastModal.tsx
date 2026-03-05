import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Rss, Search, Plus, Loader2, X } from 'lucide-react'
import { addPodcast } from '../api/podcasts'

interface SearchResult {
  trackName: string
  artistName: string
  artworkUrl60: string
  feedUrl: string
}

export default function AddPodcastModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [feedUrl, setFeedUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Debounced search via iTunes API
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=podcast&limit=6`
        )
        const data = await res.json()
        setSearchResults(
          (data.results || []).filter((r: SearchResult) => r.feedUrl)
        )
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [searchQuery])

  const addMutation = useMutation({
    mutationFn: addPodcast,
    onSuccess: (podcast) => {
      queryClient.invalidateQueries({ queryKey: ['podcasts'] })
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      onClose()
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
      setError('Please enter or select an RSS feed URL')
      return
    }

    addMutation.mutate({ feed_url: feedUrl.trim() })
  }

  const selectSearchResult = (result: SearchResult) => {
    setFeedUrl(result.feedUrl)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/30"
      onClick={onClose}
    >
      <div
        className="shadow-xl w-full max-w-lg mx-4"
        style={{ backgroundColor: '#FFFFE6' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-lg font-semibold text-zinc-900" style={{ letterSpacing: '-0.5px' }}>
            Add Podcast
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* Instructions */}
          <p className="text-[13px] text-zinc-500 mb-5 leading-relaxed">
            Search for a podcast by name, or paste an RSS feed URL directly. The 5 most recent episodes will be automatically downloaded and queued for processing.
          </p>

          {/* Search */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
              Search by name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Lex Fridman, Huberman Lab, The Daily..."
                className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 outline-none text-sm text-zinc-900 placeholder:text-zinc-300 transition-colors"
                style={{ backgroundColor: '#FFFFF5' }}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 animate-spin" />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border border-zinc-200 border-t-0 divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectSearchResult(result)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors"
                  >
                    <img
                      src={result.artworkUrl60}
                      alt=""
                      className="w-9 h-9 object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 truncate">{result.trackName}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{result.artistName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-[11px] text-zinc-400 uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          {/* RSS Feed URL */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
                RSS Feed URL
              </label>
              <div className="relative">
                <Rss className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <input
                  type="url"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 outline-none text-sm text-zinc-900 placeholder:text-zinc-300 transition-colors"
                  style={{ backgroundColor: '#FFFFF5' }}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 border border-red-300 text-sm text-red-600 mb-4">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={addMutation.isPending || !feedUrl.trim()}
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
          </form>
        </div>
      </div>
    </div>
  )
}
