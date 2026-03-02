interface StatusBadgeProps {
  status: string
  type?: 'audio' | 'transcription' | 'analysis'
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  downloading: 'bg-blue-100 text-blue-700 animate-pulse',
  downloaded: 'bg-green-100 text-green-700',
  processing: 'bg-yellow-100 text-yellow-700 animate-pulse',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status}
    </span>
  )
}
