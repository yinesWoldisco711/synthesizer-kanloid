'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { midiToName, midiToSolfege } from '@/lib/music'
import { LANGUAGES, phoneticHint } from '@/lib/phonetics'
import type { Note } from '@/lib/types'
import { useStudio } from './studio-provider'

interface Props {
  note: Note
  left: number
  top: number
  maxWidth: number
  onClose: () => void
  onNext: (currentId: string) => void
}

const PANEL_W = 260

export function LyricEditor({ note, left, top, maxWidth, onClose, onNext }: Props) {
  const { setNotes, language } = useStudio()
  const [value, setValue] = useState(note.lyric)
  const inputRef = useRef<HTMLInputElement>(null)
  const lang = LANGUAGES.find((l) => l.value === language)!

  useEffect(() => {
    setValue(note.lyric)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [note.id, note.lyric])

  const commit = () => {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, lyric: value.trim() } : n)))
  }

  const x = Math.max(8, Math.min(left, maxWidth - PANEL_W - 8))
  const y = Math.max(8, top)

  return (
    <div
      role="dialog"
      aria-label={`Letra para la nota ${midiToName(note.midi)}`}
      className="absolute z-40 rounded-xl border border-border bg-card p-3 shadow-2xl shadow-black/50"
      style={{ left: x, top: y, width: PANEL_W }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {midiToName(note.midi)} · {midiToSolfege(note.midi)} · {lang.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Cerrar editor de letra"
        >
          <X className="size-4" />
        </button>
      </div>
      <label htmlFor="lyric-input" className="sr-only">
        Sílaba o palabra
      </label>
      <input
        id="lyric-input"
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            onNext(note.id)
          } else if (e.key === 'Escape') {
            onClose()
          }
        }}
        placeholder={lang.placeholder}
        lang={language}
        autoComplete="off"
        autoCapitalize="off"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
      <p className="mt-2 font-mono text-xs text-primary">{phoneticHint(value, language)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{lang.hint}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            commit()
            onClose()
          }}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Check className="size-4" /> Listo
        </button>
        <button
          type="button"
          onClick={() => {
            commit()
            onNext(note.id)
          }}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
        >
          Siguiente <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
