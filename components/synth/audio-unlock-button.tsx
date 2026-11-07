'use client'

import { useState } from 'react'
import { Loader2, Volume2 } from 'lucide-react'
import { useStudio } from './studio-provider'

export function AudioUnlockButton() {
  const { audioReady, startAudio } = useStudio()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  if (audioReady) {
    return (
      <div
        role="status"
        className="fixed left-1/2 top-3 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-background/90 px-3 py-1.5 text-xs font-medium text-primary shadow-lg backdrop-blur"
      >
        <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        Motor de audio activo
      </div>
    )
  }

  return (
    <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 flex-col items-center gap-1">
      <button
        type="button"
        onClick={async () => {
          setLoading(true)
          setError(false)
          try {
            await startAudio()
          } catch {
            setError(true)
          } finally {
            setLoading(false)
          }
        }}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-bold text-[#06121a] shadow-xl shadow-primary/30 ring-4 ring-primary/20 hover:brightness-110"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
        ▶ Activar Motor de Audio
      </button>
      {error && (
        <p role="alert" className="rounded-md bg-background/90 px-2 py-1 text-xs text-destructive">
          No se pudo iniciar el audio. Toca de nuevo.
        </p>
      )}
    </div>
  )
}
