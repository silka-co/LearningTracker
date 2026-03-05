import { Loader2, Check, X, Minus, Download, Mic, Brain } from 'lucide-react'

interface StatusBadgeProps {
  status: string
  type?: 'audio' | 'transcription' | 'analysis'
  showIcon?: boolean
}

const STATUS_CONFIG: Record<string, { bg: string; icon?: React.ReactNode; label?: string }> = {
  pending: { bg: 'bg-zinc-100 text-zinc-400' },
  downloading: { bg: 'bg-zinc-100 text-zinc-600', icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Downloading...' },
  downloaded: { bg: 'bg-emerald-50 text-emerald-600', icon: <Check className="w-3 h-3" /> },
  processing: { bg: 'bg-zinc-100 text-zinc-600', icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Processing...' },
  completed: { bg: 'bg-emerald-50 text-emerald-600', icon: <Check className="w-3 h-3" /> },
  failed: { bg: 'bg-red-50 text-red-500', icon: <X className="w-3 h-3" /> },
  skipped: { bg: 'bg-zinc-50 text-zinc-300', icon: <Minus className="w-3 h-3" /> },
}

export default function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${config.bg}`}>
      {showIcon && config.icon}
      {config.label || status}
    </span>
  )
}

// Step-based pipeline component for episode detail
const STEP_ICONS = {
  audio: Download,
  transcription: Mic,
  analysis: Brain,
}

const STEP_LABELS = {
  audio: 'Download Audio',
  transcription: 'Transcribe',
  analysis: 'AI Analysis',
}

const ACTIVE_LABELS: Record<string, Record<string, string>> = {
  audio: { downloading: 'Downloading audio file...', downloaded: 'Audio ready' },
  transcription: { processing: 'Transcribing with Whisper...', completed: 'Transcript ready' },
  analysis: { processing: 'Analyzing with Claude AI...', completed: 'Analysis complete' },
}

const WAIT_MESSAGES: Record<string, Record<string, string>> = {
  audio: { downloading: 'This may take a few minutes depending on episode length.' },
  transcription: { processing: 'Transcription can take several minutes for long episodes.' },
  analysis: { processing: 'Claude is generating summaries and insights.' },
}

type StepKey = 'audio' | 'transcription' | 'analysis'

function getStepState(status: string): 'idle' | 'active' | 'done' | 'error' {
  if (status === 'pending') return 'idle'
  if (['downloading', 'processing'].includes(status)) return 'active'
  if (['downloaded', 'completed'].includes(status)) return 'done'
  if (status === 'failed') return 'error'
  return 'idle'
}

interface PipelineStepsProps {
  audioStatus: string
  transcriptionStatus: string
  analysisStatus: string
  errorMessage?: string | null
}

export function PipelineSteps({ audioStatus, transcriptionStatus, analysisStatus, errorMessage }: PipelineStepsProps) {
  const steps: { key: StepKey; status: string }[] = [
    { key: 'audio', status: audioStatus },
    { key: 'transcription', status: transcriptionStatus },
    { key: 'analysis', status: analysisStatus },
  ]

  const activeStep = steps.find(s => getStepState(s.status) === 'active')
  const waitMessage = activeStep ? WAIT_MESSAGES[activeStep.key]?.[activeStep.status] : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const state = getStepState(step.status)
          const Icon = STEP_ICONS[step.key]
          const activeLabel = ACTIVE_LABELS[step.key]?.[step.status]
          const label = activeLabel || STEP_LABELS[step.key]

          return (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              {/* Step circle + label */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md flex-1 transition-all ${
                state === 'active' ? 'bg-zinc-100 border border-zinc-300' :
                state === 'done' ? 'bg-emerald-50/50 border border-emerald-200' :
                state === 'error' ? 'bg-red-50 border border-red-200' :
                'bg-zinc-50 border border-zinc-100'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  state === 'active' ? 'bg-zinc-900 text-white' :
                  state === 'done' ? 'bg-emerald-500 text-white' :
                  state === 'error' ? 'bg-red-500 text-white' :
                  'bg-zinc-200 text-zinc-400'
                }`}>
                  {state === 'active' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : state === 'done' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : state === 'error' ? (
                    <X className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-medium truncate ${
                    state === 'active' ? 'text-zinc-700' :
                    state === 'done' ? 'text-emerald-600' :
                    state === 'error' ? 'text-red-600' :
                    'text-zinc-400'
                  }`}>
                    {label}
                  </p>
                  {state === 'active' && (
                    <p className="text-[10px] text-zinc-400 font-medium">In progress</p>
                  )}
                </div>
              </div>

              {/* Connector */}
              {i < steps.length - 1 && (
                <div className={`flex-shrink-0 text-sm ${
                  getStepState(steps[i + 1].status) !== 'idle' ? 'text-emerald-400' : 'text-zinc-200'
                }`}>
                  →
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Wait message */}
      {waitMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md">
          <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin flex-shrink-0" />
          <p className="text-[11px] text-zinc-500">{waitMessage} This page will update automatically.</p>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-[11px] text-red-600">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
