import api from './client'
import type { Topic } from '../types'

export async function getTopics(): Promise<Topic[]> {
  const { data } = await api.get('/topics')
  return data
}

export async function createTopic(body: { name: string; description?: string; color?: string }): Promise<Topic> {
  const { data } = await api.post('/topics', body)
  return data
}

export async function deleteTopic(id: number): Promise<void> {
  await api.delete(`/topics/${id}`)
}
