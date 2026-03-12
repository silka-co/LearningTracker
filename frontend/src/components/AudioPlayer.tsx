import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'

function Forward30Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 -960 960 960" fill="currentColor">
      <path d="M300-320v-60h100v-40h-60v-40h60v-40H300v-60h120q17 0 28.5 11.5T460-520v160q0 17-11.5 28.5T420-320H300Zm240 0q-17 0-28.5-11.5T500-360v-160q0-17 11.5-28.5T540-560h80q17 0 28.5 11.5T660-520v160q0 17-11.5 28.5T620-320h-80Zm20-60h40v-120h-40v120ZM339.5-108.5q-65.5-28.5-114-77t-77-114Q120-365 120-440t28.5-140.5q28.5-65.5 77-114t114-77Q405-800 480-800h6l-62-62 56-58 160 160-160 160-56-58 62-62h-6q-117 0-198.5 81.5T200-440q0 117 81.5 198.5T480-160q117 0 198.5-81.5T760-440h80q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-80q-75 0-140.5-28.5Z" />
    </svg>
  )
}

interface AudioPlayerProps {
  src: string
  durationSeconds?: number | null
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer({ src, durationSeconds }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationSeconds ?? 0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const onEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const time = Number(e.target.value)
    audio.currentTime = time
    setCurrentTime(time)
  }, [])

  const skipForward30 = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = Math.min(audio.currentTime + 30, duration)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }, [duration])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-2 w-full">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:border-zinc-900 transition-colors focus:outline-none"
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5 ml-0.5" />
        )}
      </button>

      {/* Progress slider */}
      <div className="relative h-5 flex items-center" style={{ width: '50px' }}>
        <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-900/5">
          <div
            className="h-full rounded-full bg-zinc-400 transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Time */}
      <span className="text-zinc-400 tabular-nums flex-shrink-0 leading-8">
        {formatTime(currentTime)}
      </span>

      {/* Skip forward 30s – only visible when playing */}
      {isPlaying && (
        <button
          onClick={skipForward30}
          className="flex-shrink-0 w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:border-zinc-900 transition-colors focus:outline-none"
          title="Forward 30 seconds"
        >
          <Forward30Icon className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
