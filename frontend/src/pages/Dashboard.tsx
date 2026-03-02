import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Rss, Clock, ChevronRight } from 'lucide-react'
import { getPodcasts } from '../api/podcasts'
import { getEpisodes } from '../api/episodes'
import { useTopicStore } from '../store/topicStore'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const { activeTopicId } = useTopicStore()

  const { data: podcasts, isLoading: loadingPodcasts } = useQuery({
    queryKey: ['podcasts', activeTopicId],
    queryFn: () => getPodcasts(activeTopicId ?? undefined),
  })

  const { data: recentEpisodes, isLoading: loadingEpisodes } = useQuery({
    queryKey: ['episodes', 'recent', activeTopicId],
    queryFn: () => getEpisodes({ topic_id: activeTopicId ?? undefined, limit: 10 }),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Podcasts */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Your Podcasts</h2>
        {loadingPodcasts ? (
          <p className="text-gray-500">Loading...</p>
        ) : !podcasts?.length ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Rss className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No podcasts yet</p>
            <Link
              to="/add"
              className="inline-flex items-center gap-1 text-podcast-primary hover:text-podcast-primary/80 font-medium text-sm"
            >
              Add your first podcast
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {podcasts.map((podcast) => (
              <Link
                key={podcast.id}
                to={`/podcasts/${podcast.id}`}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-podcast-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {podcast.image_url ? (
                    <img
                      src={podcast.image_url}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-podcast-primary/10 flex items-center justify-center flex-shrink-0">
                      <Rss className="w-6 h-6 text-podcast-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900 truncate">{podcast.title}</h3>
                    {podcast.author && (
                      <p className="text-sm text-gray-500 truncate">{podcast.author}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {podcast.episode_count} episode{podcast.episode_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Episodes */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Episodes</h2>
        {loadingEpisodes ? (
          <p className="text-gray-500">Loading...</p>
        ) : !recentEpisodes?.length ? (
          <p className="text-gray-500 text-sm">No episodes yet. Add a podcast to get started.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {recentEpisodes.map((episode) => (
              <Link
                key={episode.id}
                to={`/episodes/${episode.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {episode.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    {episode.published_at && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(episode.published_at).toLocaleDateString()}
                      </span>
                    )}
                    {episode.duration_seconds && (
                      <span className="text-xs text-gray-400">
                        {Math.round(episode.duration_seconds / 60)}m
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={episode.audio_status} type="audio" />
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
