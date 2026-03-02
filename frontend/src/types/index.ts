export interface Topic {
  id: number
  name: string
  description: string | null
  color: string
  created_at: string
  podcast_count: number
}

export interface Podcast {
  id: number
  title: string
  feed_url: string
  description: string | null
  author: string | null
  image_url: string | null
  topic_id: number
  topic?: Topic
  episode_count: number
  last_fetched_at: string | null
  created_at: string
}

export interface Episode {
  id: number
  podcast_id: number
  guid: string
  title: string
  description: string | null
  audio_url: string
  published_at: string | null
  duration_seconds: number | null
  audio_status: 'pending' | 'downloading' | 'downloaded' | 'failed' | 'skipped'
  transcription_status: 'pending' | 'processing' | 'completed' | 'failed'
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed'
  audio_file_path: string | null
  error_message: string | null
  created_at: string
}

export interface EpisodeListItem {
  id: number
  podcast_id: number
  title: string
  published_at: string | null
  duration_seconds: number | null
  audio_status: string
  transcription_status: string
  analysis_status: string
}
