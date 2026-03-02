import { Outlet, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Headphones, Plus, LayoutDashboard } from 'lucide-react'
import { getTopics } from '../../api/topics'
import { useTopicStore } from '../../store/topicStore'

export default function MainLayout() {
  const location = useLocation()
  const { activeTopicId, setActiveTopicId } = useTopicStore()
  const { data: topics } = useQuery({ queryKey: ['topics'], queryFn: getTopics })

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2 text-podcast-primary font-bold text-lg">
            <Headphones className="w-6 h-6" />
            PodLearn
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/'
                ? 'bg-podcast-primary/10 text-podcast-primary'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            to="/add"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/add'
                ? 'bg-podcast-primary/10 text-podcast-primary'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Podcast
          </Link>
        </nav>

        {/* Topic filter */}
        <div className="p-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Topics</h3>
          <button
            onClick={() => setActiveTopicId(null)}
            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
              activeTopicId === null
                ? 'bg-gray-100 font-medium text-gray-900'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Topics
          </button>
          {topics?.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setActiveTopicId(topic.id)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
                activeTopicId === topic.id
                  ? 'bg-gray-100 font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: topic.color }}
              />
              {topic.name}
              <span className="ml-auto text-xs text-gray-400">{topic.podcast_count}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
