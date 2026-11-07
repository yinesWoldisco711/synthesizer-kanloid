'use client'

import { useRef, useState } from 'react'
import { Download, Minus, Play, Plus, SkipBack, Square, Trash2, Upload } from 'lucide-react'
import { liveEngine } from '@/lib/live-engine'
import { getVowel, LANGUAGES } from '@/lib/phonetics'
import { buildProjectJson, downloadBlob, parseProjectJson, safeFileName } from '@/lib/project-file'
import type { Language, Vowel } from '@/lib/types'
import { PianoRoll } from './piano-roll'
import { RenderPanel } from './render-panel'
import { useStudio } from './studio-provider'

const SNAPS = [
  { value: 1, label: '1/4' },
  { value: 0.5, label: '1/8' },
  { value: 0.25, label: '1/16' },
]

const VOWELS: { value: Vowel; label: string }[] = [
  { value: 'a', label: 'Ah' },
  { value: 'o', label: 'Oh' },
  { value: 'e', label: 'Eh' },
  { value: 'i', label: 'Ih' },
  { value: 'u', label: 'Uh' },
]

const fieldClass =
  'h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30'
const iconButton =
  'inline-flex size-9 items-center justify-center rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary/70 disabled:opacity-40'

export function PianoRollTab() {
  const studio = useStudio()
  const {
    notes,
    setNotes,
    bpm,
    setBpm,
    bars,
    setBars,
    language,
    setLanguage,
    guideVowel,
    setGuideVowel,
    cursorBeat,
    setCursorBeat,
    isPlaying,
    setIsPlaying,
    selectedId,
    setSelectedId,
    audioReady,
    startAudio,
    character,
    updateCharacter,
  } = studio
  const [beatWidth, setBeatWidth] = useState(56)
  const [snap, setSnap] = useState(0.25)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const togglePlay = async () => {
    if (isPlaying) {
      liveEngine.stop()
      setIsPlaying(false)
      return
    }
    if (!audioReady) await startAudio()
    liveEngine.play(
      notes.map((n) => ({ ...n, vowel: getVowel(n.lyric, language) })),
      bpm,
      cursorBeat,
      () => setIsPlaying(false),
    )
    setIsPlaying(true)
  }

  const exportJson = () => {
    const data = buildProjectJson({ notes, bpm, bars, language, character })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${safeFileName(character.name)}-partitura.json`)
  }

  const importJson = async (file: File) => {
    try {
      const project = parseProjectJson(await file.text())
      liveEngine.stop()
      setIsPlaying(false)
      setNotes(project.notes)
      setBpm(project.bpm)
      setBars(project.bars)
      setLanguage(project.language)
      setCursorBeat(0)
      if (project.character) {
        const { name, provider, age, gender, description, profile } = project.character
        updateCharacter({
          ...(name ? { name } : {}),
          ...(provider ? { provider } : {}),
          ...(age ? { age } : {}),
          ...(gender ? { gender } : {}),
          ...(description ? { description } : {}),
          ...(profile ? { profile } : {}),
        })
      }
      setMessage(`Partitura importada: ${project.notes.length} notas.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo leer el archivo JSON.')
    }
  }

  return (
    <section aria-labelledby="piano-roll-title" className="flex flex-col gap-4">
      <h2 id="piano-roll-title" className="sr-only">
        Piano Roll
      </h2>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 sm:p-3">
        <button
          type="button"
          onClick={() => {
            liveEngine.stop()
            setIsPlaying(false)
            setCursorBeat(0)
          }}
          className={iconButton}
          aria-label="Volver al inicio"
        >
          <SkipBack className="size-4" />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {isPlaying ? <Square className="size-4" /> : <Play className="size-4" />}
          {isPlaying ? 'Detener' : 'Reproducir guía'}
        </button>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          BPM
          <input
            type="number"
            min={30}
            max={300}
            value={bpm}
            onChange={(e) => setBpm(Math.min(300, Math.max(30, Number(e.target.value) || 120)))}
            className={`${fieldClass} w-16`}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Compases
          <input
            type="number"
            min={4}
            max={256}
            value={bars}
            onChange={(e) => setBars(Math.min(256, Math.max(4, Number(e.target.value) || 16)))}
            className={`${fieldClass} w-16`}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Idioma
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className={fieldClass}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Vocal guía
          <select value={guideVowel} onChange={(e) => setGuideVowel(e.target.value as Vowel)} className={fieldClass}>
            {VOWELS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Cuadrícula
          <select value={snap} onChange={(e) => setSnap(Number(e.target.value))} className={fieldClass}>
            {SNAPS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1" role="group" aria-label="Zoom horizontal">
          <button
            type="button"
            className={iconButton}
            onClick={() => setBeatWidth((w) => Math.max(24, w - 12))}
            aria-label="Alejar"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => setBeatWidth((w) => Math.min(140, w + 12))}
            aria-label="Acercar"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <button
          type="button"
          className={iconButton}
          disabled={!selectedId}
          onClick={() => {
            setNotes((prev) => prev.filter((n) => n.id !== selectedId))
            setSelectedId(null)
          }}
          aria-label="Eliminar nota seleccionada"
        >
          <Trash2 className="size-4" />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-secondary"
          >
            <Upload className="size-4" /> Importar JSON
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-secondary"
          >
            <Download className="size-4" /> Exportar JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Importar partitura JSON"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importJson(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {message && (
        <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}

      <PianoRoll beatWidth={beatWidth} snap={snap} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Doble clic / doble toque</strong> en la cuadrícula para crear una nota
        (mantén y arrastra para estirarla). Arrastra una nota para moverla o su borde derecho para cambiar su duración.{' '}
        <strong className="text-foreground">Doble clic sobre una nota</strong> para escribir su sílaba. Toca la regla
        superior para mover el cursor de inicio. Teclas: Supr para borrar, Enter para editar letra.
      </p>

      <RenderPanel />
    </section>
  )
}
