import api from './client'
import type { ChatDetailResponse, ChatListItem, QAMessageResponse, QASessionResponse } from '../types'

/** All chats listing */
export async function getAllChats(params?: { search?: string; topic_id?: number; episode_id?: number }): Promise<ChatListItem[]> {
  const { data } = await api.get('/chats', { params })
  return data
}

/** Single chat detail */
export async function getChatDetail(sessionId: number): Promise<ChatDetailResponse> {
  const { data } = await api.get(`/chats/${sessionId}`)
  return data
}

/** Episode-level chat */
export async function sendEpisodeMessage(
  episodeId: number,
  content: string,
): Promise<QAMessageResponse> {
  const { data } = await api.post(`/episodes/${episodeId}/chat`, { content })
  return data
}

export async function getEpisodeChatHistory(
  episodeId: number,
): Promise<QASessionResponse | null> {
  const { data } = await api.get(`/episodes/${episodeId}/chat`)
  return data
}

export async function clearEpisodeChat(episodeId: number): Promise<void> {
  await api.delete(`/episodes/${episodeId}/chat`)
}

/** Dashboard-level chat */
export async function sendDashboardMessage(
  content: string,
): Promise<QAMessageResponse> {
  const { data } = await api.post('/chat', { content })
  return data
}

export async function getDashboardChatHistory(): Promise<QASessionResponse | null> {
  const { data } = await api.get('/chat')
  return data
}

export async function clearDashboardChat(): Promise<void> {
  await api.delete('/chat')
}

/** Topic-level chat */
export async function sendTopicMessage(
  topicId: number,
  content: string,
): Promise<QAMessageResponse> {
  const { data } = await api.post(`/topics/${topicId}/chat`, { content })
  return data
}

export async function getTopicChatHistory(
  topicId: number,
): Promise<QASessionResponse | null> {
  const { data } = await api.get(`/topics/${topicId}/chat`)
  return data
}

export async function clearTopicChat(topicId: number): Promise<void> {
  await api.delete(`/topics/${topicId}/chat`)
}
