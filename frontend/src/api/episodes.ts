import api from './client'
import type { Episode, EpisodeListItem, Transcript, EpisodeSummary, InsightItem } from '../types'

export async function getEpisodes(params?: {
  podcast_id?: number
  topic_id?: number
  has_topic?: boolean
  audio_status?: string
  analysis_status?: string
  trashed?: boolean
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

export async function getTranscript(episodeId: number): Promise<Transcript> {
  const { data } = await api.get(`/episodes/${episodeId}/transcript`)
  return data
}

export async function getAnalysis(episodeId: number): Promise<EpisodeSummary> {
  const { data } = await api.get(`/episodes/${episodeId}/analysis`)
  return data
}

export async function updateEpisodeTopic(
  episodeId: number,
  topicId: number | null,
): Promise<void> {
  await api.patch(`/episodes/${episodeId}/topic`, { topic_id: topicId })
}

export async function toggleEpisodeTopic(
  episodeId: number,
  topicId: number,
): Promise<{ action: string; topic_ids: number[] }> {
  const { data } = await api.post(`/episodes/${episodeId}/topics/toggle`, { topic_id: topicId })
  return data
}

export async function trashEpisode(id: number): Promise<void> {
  await api.post(`/episodes/${id}/trash`)
}

export async function restoreEpisode(id: number): Promise<void> {
  await api.post(`/episodes/${id}/restore`)
}

export async function suggestTopic(episodeId: number): Promise<{
  match: 'existing' | 'suggested' | 'none'
  topic_id: number | null
  topic_name: string | null
}> {
  const { data } = await api.get(`/episodes/${episodeId}/suggest-topic`)
  return data
}

export async function getInsights(params?: { days?: number; topic_id?: number; limit?: number }): Promise<InsightItem[]> {
  const { data } = await api.get('/episodes/insights', { params })
  return data
}

export async function getNewEpisodesCount(): Promise<number> {
  const { data } = await api.get('/episodes/new/count')
  return data.count
}
