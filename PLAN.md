# Per-Episode Topics + Topic Detail Page

## Overview
Add per-episode topic assignment (like Granola's folders) so episodes can be individually categorized, and create a new Topic Detail page that shows when you click a topic in the sidebar — with the topic name, an AI chat bar scoped to that topic, and a list of all episodes in that topic.

## What Changes

### 1. Database: Add `topic_id` to episodes
- Add `topic_id` (nullable FK → topics) column to the `episodes` table
- Auto-populate: when episodes are fetched from RSS, inherit the podcast's `topic_id`
- Episodes can later be reassigned to a different topic via the UI

**Files:** `001_initial_schema.sql` (add column), `Episode` model, `EpisodeListItem` schema

### 2. Backend: Episode topic assignment endpoint
- `PATCH /api/episodes/{episode_id}/topic` — set/change an episode's topic
- Update `EpisodeListItem` schema to include `topic_id` and `topic_name`
- Update episodes list query: when filtering by `topic_id`, filter directly on `Episode.topic_id` (not through podcast)

**Files:** `episodes.py` router, `episode.py` schema

### 3. Backend: Topic-scoped chat endpoints
- `POST /api/topics/{topic_id}/chat` — send message, context = summaries of all analyzed episodes in that topic
- `GET /api/topics/{topic_id}/chat` — get topic chat history
- `DELETE /api/topics/{topic_id}/chat` — clear topic chat
- Uses the existing `QASession.topic_id` field (already in the DB, currently unused)

**Files:** `qa.py` router, `qa.ts` frontend API

### 4. Frontend: New Topic Detail page (`/topics/:id`)
- Large topic name as heading (same serif font as "My Collection")
- ChatBar component with `topicId` prop (new mode alongside `episodeId` and dashboard)
- Episode list showing all episodes in that topic (same row style as Dashboard recent episodes)
- Each episode row has a topic dropdown (see step 5)

**Files:** New `TopicDetail.tsx` page, `App.tsx` route, `ChatBar.tsx` (add topicId support)

### 5. Frontend: Topic picker on episode rows
- Small dropdown/chip on the right side of each episode row (on both Dashboard and TopicDetail pages)
- Shows current topic name; click opens a dropdown to reassign
- Clicking the dropdown does NOT navigate to the episode (stop propagation)
- On change, calls `PATCH /api/episodes/{id}/topic` and invalidates queries

**Files:** New `TopicPicker.tsx` component, `Dashboard.tsx`, `TopicDetail.tsx`

### 6. Sidebar: Topics become links to Topic Detail page
- Change topic buttons from filter-toggling buttons to `<Link to="/topics/:id">`
- Remove `activeTopicId` filter store (topics now navigate instead of filter)
- Keep "All Topics" label or remove — "My Collection" already shows everything
- Active state based on current route (`/topics/:id`)

**Files:** `MainLayout.tsx`, can remove `topicStore.ts`

### 7. Auto-populate existing episodes
- On app startup / migration: set `episode.topic_id = podcast.topic_id` for all episodes that have `topic_id IS NULL`
- When new episodes are fetched via RSS, set `topic_id` from the podcast's topic

**Files:** Migration SQL, `feed_service.py` or wherever episodes are created from RSS

## Execution Order
1. DB migration + model changes (topic_id on episodes)
2. Backend schema + endpoint updates (PATCH topic, list includes topic info)
3. Backend topic-scoped chat endpoints
4. Frontend: TopicPicker component
5. Frontend: TopicDetail page + route
6. Frontend: ChatBar topicId support + API functions
7. Sidebar links update
8. Auto-populate migration
