import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import Dashboard from './pages/Dashboard'
import NewEpisodes from './pages/NewEpisodes'
import Chats from './pages/Chats'
import ChatDetail from './pages/ChatDetail'
import PodcastDetail from './pages/PodcastDetail'
import EpisodeDetail from './pages/EpisodeDetail'
import TopicDetail from './pages/TopicDetail'
import AllTopics from './pages/AllTopics'
import AllEpisodes from './pages/AllEpisodes'
import Podcasts from './pages/Podcasts'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewEpisodes />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/chats/:id" element={<ChatDetail />} />
        <Route path="/podcasts" element={<Podcasts />} />
        <Route path="/podcasts/:id" element={<PodcastDetail />} />
        <Route path="/episodes" element={<AllEpisodes />} />
        <Route path="/episodes/:id" element={<EpisodeDetail />} />
        <Route path="/topics" element={<AllTopics />} />
        <Route path="/topics/:id" element={<TopicDetail />} />
      </Route>
    </Routes>
  )
}
