import api from './client'
import type { Podcast } from '../types'

export async function getPodcasts(topicId?: number): Promise<Podcast[]> {
  const params = topicId ? { topic_id: topicId } : {}
  const { data } = await api.get('/podcasts', { params })
  return data
}

export async function getPodcast(id: number): Promise<Podcast> {
  const { data } = await api.get(`/podcasts/${id}`)
  return data
}

export async function addPodcast(body: { feed_url: string; topic_id: number }): Promise<Podcast> {
  const { data } = await api.post('/podcasts', body)
  return data
}

export async function refreshPodcast(id: number): Promise<Podcast> {
  const { data } = await api.post(`/podcasts/${id}/refresh`)
  return data
}

export async function deletePodcast(id: number): Promise<void> {
  await api.delete(`/podcasts/${id}`)
}
