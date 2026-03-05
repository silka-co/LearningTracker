export interface Topic {
  id: number
  name: string
  description: string | null
  color: string
  created_at: string
  episode_count: number
}

export interface Podcast {
  id: number
  title: string
  feed_url: string
  description: string | null
  author: string | null
  image_url: string | null
  episode_count: number
  total_episode_count: number
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
  topic_ids: number[]
  topic_names: string[]
}

export interface TranscriptSegment {
  segment_index: number
  start_time: number
  end_time: number
  text: string
}

export interface Transcript {
  id: number
  episode_id: number
  full_text: string
  language: string | null
  word_count: number | null
  created_at: string
  segments: TranscriptSegment[]
}

export interface EpisodeListItem {
  id: number
  podcast_id: number
  topic_id: number | null
  topic_ids: number[]
  title: string
  podcast_title: string | null
  topic_name: string | null
  topic_names: string[]
  published_at: string | null
  duration_seconds: number | null
  audio_status: string
  transcription_status: string
  analysis_status: string
  created_at: string | null
  trashed_at: string | null
}

export interface EpisodeSummary {
  id: number
  episode_id: number
  one_line: string
  short_summary: string
  detailed_summary: string
  key_points: string[]
  notable_quotes: { quote: string; speaker: string }[]
  created_at: string
}

export interface InsightTopic {
  id: number
  name: string
  color: string
}

export interface InsightItem {
  episode_id: number
  episode_title: string
  podcast_title: string | null
  published_at: string | null
  short_summary: string
  analyzed_at: string
  topics: InsightTopic[]
}

export interface ChatListItem {
  id: number
  first_question: string
  last_message_at: string
  context_type: 'episode' | 'topic' | 'dashboard'
  episode_id: number | null
  topic_id: number | null
  topic_name: string | null
  episode_title: string | null
  podcast_title: string | null
  message_count: number
}

export interface ChatDetailResponse {
  id: number
  episode_id: number | null
  topic_id: number | null
  context_type: 'episode' | 'topic' | 'dashboard'
  topic_name: string | null
  episode_title: string | null
  podcast_title: string | null
  source_episode_count: number
  created_at: string
  messages: QAMessageResponse[]
}

export interface QAMessageResponse {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  follow_up_questions: string[] | null
  created_at: string
}

export interface QASessionResponse {
  id: number
  episode_id: number | null
  topic_id: number | null
  title: string | null
  created_at: string
  messages: QAMessageResponse[]
}
