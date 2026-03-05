import api from './client'
import type { Podcast } from '../types'

export async function getPodcasts(): Promise<Podcast[]> {
  const { data } = await api.get('/podcasts')
  return data
}

export async function getPodcast(id: number): Promise<Podcast> {
  const { data } = await api.get(`/podcasts/${id}`)
  return data
}

export async function addPodcast(body: { feed_url: string }): Promise<Podcast> {
  const { data } = await api.post('/podcasts', body)
  return data
}

export async function refreshPodcast(id: number): Promise<Podcast> {
  const { data } = await api.post(`/podcasts/${id}/refresh`)
  return data
}

export async function refreshStalePodcasts(): Promise<{ refreshed: number; new_episodes: number }> {
  const { data } = await api.post('/podcasts/refresh-stale')
  return data
}

export async function refreshAllPodcasts(): Promise<{ refreshed: number; new_episodes: number }> {
  const { data } = await api.post('/podcasts/refresh-all')
  return data
}

export async function unfollowPodcast(id: number): Promise<{ message: string; kept_episodes: number }> {
  const { data } = await api.post(`/podcasts/${id}/unfollow`)
  return data
}

export async function deletePodcast(id: number): Promise<void> {
  await api.delete(`/podcasts/${id}`)
}
