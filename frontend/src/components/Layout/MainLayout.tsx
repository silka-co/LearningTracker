import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Home, Layers, Plus, Disc3, MessageSquare, Search, Settings } from 'lucide-react'
import { getTopics, createTopic } from '../../api/topics'
import { getNewEpisodesCount } from '../../api/episodes'
import { getAllChats } from '../../api/qa'

export default function MainLayout() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data: topics } = useQuery({ queryKey: ['topics'], queryFn: getTopics })
  const { data: newCount } = useQuery({
    queryKey: ['episodes', 'new', 'count'],
    queryFn: getNewEpisodesCount,
    refetchInterval: 60_000,
  })
  const { data: recentChats } = useQuery({
    queryKey: ['chats'],
    queryFn: () => getAllChats(),
  })

  // Cmd+K global shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // TODO: open search modal
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const [showAllTopics, setShowAllTopics] = useState(false)
  const [showNewTopicModal, setShowNewTopicModal] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')

  const createMutation = useMutation({
    mutationFn: createTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      setNewTopicName('')
      setShowNewTopicModal(false)
    },
  })

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTopicName.trim()) return
    createMutation.mutate({ name: newTopicName.trim() })
  }

  const visibleTopics = showAllTopics ? topics : topics?.slice(0, 10)
  const hasMore = (topics?.length ?? 0) > 10

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 border-r flex flex-col" style={{ backgroundColor: '#FFFFE6' }}>
        <div className="px-5 py-6">
          <Link to="/" className="text-zinc-900 text-xl font-semibold">
            Smartie
          </Link>
        </div>

        {/* Search trigger */}
        <div className="px-5 pb-3">
          <button
            onClick={() => {
              // TODO: open search modal
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-200 text-[13px] text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-colors"
            style={{ backgroundColor: '#FFFFF5' }}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-zinc-200 bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5">
          <Link
            to="/"
            className={`flex items-center gap-2.5 px-6 py-2 text-[13px] font-medium tracking-wide transition-colors ${
              location.pathname === '/'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-900/5'
            }`}
          >
            <Home className="w-4 h-4" />
            Home
          </Link>

          <Link
            to="/new"
            className={`flex items-center gap-2.5 px-6 py-2 text-[13px] font-medium tracking-wide transition-colors ${
              location.pathname === '/new'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-900/5'
            }`}
          >
            <Disc3 className="w-4 h-4" />
            New Episodes
            {newCount != null && newCount > 0 && (
              <span className={`ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold ${
                location.pathname === '/new'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-900 text-white'
              }`}>
                {newCount}
              </span>
            )}
          </Link>

          <Link
            to="/chats"
            className={`flex items-center gap-2.5 px-6 py-2 text-[13px] font-medium tracking-wide transition-colors ${
              location.pathname === '/chats'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-900/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chats
          </Link>

          {/* Recent chats */}
          {recentChats && recentChats.length > 0 && (
            <div className="pb-1">
              <p className="pl-[50px] pr-6 py-0.5 text-[11px] font-medium text-zinc-400">Recents</p>
              {recentChats.slice(0, 10).map((chat) => (
                <Link
                  key={chat.id}
                  to={`/chats/${chat.id}`}
                  className={`block pl-[50px] pr-6 py-1 text-[13px] truncate transition-colors ${
                    location.pathname === `/chats/${chat.id}`
                      ? 'bg-zinc-900 text-white font-medium'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-900/5'
                  }`}
                >
                  {chat.first_question}
                </Link>
              ))}
            </div>
          )}

          {/* All Topics */}
          <div className="pt-2">
            <Link
              to="/topics"
              className={`flex items-center gap-2.5 px-6 py-2 text-[13px] font-medium tracking-wide transition-colors ${
                location.pathname === '/topics'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-900/5'
              }`}
            >
              <Layers className="w-4 h-4" />
              Topics
            </Link>

            {visibleTopics?.map((topic) => (
              <Link
                key={topic.id}
                to={`/topics/${topic.id}`}
                className={`w-full text-left pl-[50px] pr-6 py-1.5 text-[13px] flex items-center gap-2.5 transition-colors ${
                  location.pathname === `/topics/${topic.id}`
                    ? 'bg-zinc-900 text-white font-medium'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-900/5'
                }`}
              >
                {topic.name}
                <span className={`ml-auto text-[11px] ${location.pathname === `/topics/${topic.id}` ? 'text-zinc-400' : 'text-zinc-400'}`}>{topic.episode_count}</span>
              </Link>
            ))}

            {hasMore && !showAllTopics && (
              <button
                onClick={() => setShowAllTopics(true)}
                className="w-full text-left pl-[50px] pr-6 py-1.5 text-[13px] text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                Show more
              </button>
            )}

            <button
              onClick={() => setShowNewTopicModal(true)}
              className="w-full flex items-center gap-2.5 pl-[50px] pr-6 py-1.5 text-[13px] text-zinc-400 hover:text-zinc-900 hover:bg-zinc-900/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New topic
            </button>
          </div>
        </nav>

        {/* Bottom link */}
        <div className="px-5 py-4 border-t">
          <Link
            to="/podcasts"
            className={`flex items-center gap-2.5 text-[13px] font-medium transition-colors ${
              location.pathname === '/podcasts'
                ? 'text-zinc-900'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            Podcasts for you
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#FFFFE6' }}>
        <div className="max-w-4xl mx-auto px-8 pt-10 pb-24">
          <Outlet />
        </div>
      </main>

      {/* New Topic Modal */}
      {showNewTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleCreateTopic}
            className="bg-white rounded-lg shadow-lg p-6 w-80 space-y-4"
          >
            <h2 className="text-sm font-semibold text-zinc-900">New Topic</h2>
            <input
              autoFocus
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Topic name"
              className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
              style={{ backgroundColor: '#FFFFF5' }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowNewTopicModal(false); setNewTopicName('') }}
                className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTopicName.trim() || createMutation.isPending}
                className="px-3 py-1.5 bg-zinc-900 text-white text-sm rounded-md hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
