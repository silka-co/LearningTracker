import api from './client'
import type { Episode, EpisodeListItem } from '../types'

export async function getEpisodes(params?: {
  podcast_id?: number
  topic_id?: number
  audio_status?: string
  limit?: number
  offset?: number
}): Promise<EpisodeListItem[]> {
  const { data } = await api.get('/episodes', { params })
  return data
}

export async function getEpisode(id: number): Promise<Episode> {
  const { data } = await api.get(`/episodes/${id}`)
  return data
}

export async function processEpisode(id: number): Promise<{ message: string; task_id?: string }> {
  const { data } = await api.post(`/episodes/${id}/process`)
  return data
}
