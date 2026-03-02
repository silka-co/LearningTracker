import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import Dashboard from './pages/Dashboard'
import AddPodcast from './pages/AddPodcast'
import PodcastDetail from './pages/PodcastDetail'
import EpisodeDetail from './pages/EpisodeDetail'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add" element={<AddPodcast />} />
        <Route path="/podcasts/:id" element={<PodcastDetail />} />
        <Route path="/episodes/:id" element={<EpisodeDetail />} />
      </Route>
    </Routes>
  )
}
