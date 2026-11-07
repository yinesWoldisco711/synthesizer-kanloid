'use client'

import { Download } from 'lucide-react'
import { downloadBlob } from '@/lib/project-file'
import type { RenderResult } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{percent}%</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        >
          <span className="absolute inset-0 animate-pulse bg-white/20" />
        </div>
      </div>
    </div>
  )
}

export function AudioResult({
  result,
  tone,
  filename,
}: {
  result: RenderResult
  tone: 'primary' | 'accent'
  filename: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-sm font-semibold', tone === 'primary' ? 'text-primary' : 'text-accent')}>
          {result.label}
        </p>
        <span className="font-mono text-xs text-muted-foreground">
          {result.duration.toFixed(1)}s · {(result.blob.size / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
      <div className="flex h-12 items-center gap-px" aria-hidden="true">
        {result.peaks.map((peak, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-full', tone === 'primary' ? 'bg-primary/70' : 'bg-accent/80')}
            style={{ height: `${Math.max(4, peak * 100)}%` }}
          />
        ))}
      </div>
      <audio controls src={result.url} className="h-10 w-full" preload="auto">
        <track kind="captions" />
      </audio>
      <button
        type="button"
        onClick={() => downloadBlob(result.blob, filename)}
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
      >
        <Download className="size-3.5" /> Descargar WAV
      </button>
    </div>
  )
}
