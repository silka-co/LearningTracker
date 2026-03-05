import { create } from 'zustand'

interface TopicStore {
  activeTopicId: number | null
  setActiveTopicId: (id: number | null) => void
}

export const useTopicStore = create<TopicStore>((set) => ({
  activeTopicId: null,
  setActiveTopicId: (id) => set({ activeTopicId: id }),
}))
