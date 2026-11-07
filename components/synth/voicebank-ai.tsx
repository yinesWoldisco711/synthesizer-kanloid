'use client'

import { useRef, useState } from 'react'
import { Bot, CheckCircle2, FileAudio, Upload } from 'lucide-react'
import { liveEngine } from '@/lib/live-engine'
import { analyzeVoice } from '@/lib/voice-analysis'
import { midiToName, freqToMidi } from '@/lib/music'
import { ProgressBar } from './audio-result'
import { useStudio } from './studio-provider'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const STAGES = [
  { label: 'Subiendo audio a la caché en la nube…', until: 0.12 },
  { label: 'Separando voz del acompañamiento (UVR)…', until: 0.24 },
  { label: 'Extrayendo curva F0 (RMVPE)…', until: 0.62 },
  { label: 'Codificando timbre (HuBERT / ContentVec)…', until: 0.78 },
  { label: 'Entrenando índice RVC y modelo DiffSinger…', until: 0.94 },
  { label: 'Creando perfil de canto…', until: 1 },
]

export function VoicebankAi() {
  const { character, updateCharacter, audioReady } = useStudio()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const animateTo = async (from: number, to: number, steps = 6) => {
    for (let i = 1; i <= steps; i++) {
      setProgress(from + ((to - from) * i) / steps)
      await wait(140)
    }
  }

  const process = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setProgress(0)
    try {
      setStage(STAGES[0].label)
      await animateTo(0, STAGES[0].until)
      setStage(STAGES[1].label)
      await animateTo(STAGES[0].until, STAGES[1].until)
      setStage(STAGES[2].label)
      const profile = await analyzeVoice(file, (r) =>
        setProgress(STAGES[1].until + r * (STAGES[2].until - STAGES[1].until)),
      )
      setStage(STAGES[3].label)
      await animateTo(STAGES[2].until, STAGES[3].until)
      setStage(STAGES[4].label)
      await animateTo(STAGES[3].until, STAGES[4].until, 8)
      setStage(STAGES[5].label)
      await animateTo(STAGES[4].until, 1, 3)
      profile.name = `${character.name} · ${profile.name}`
      updateCharacter({ profile })
      if (audioReady) liveEngine.setProfile(profile)
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'No se pudo decodificar el audio. Prueba con un archivo .mp3 o .wav diferente.',
      )
    } finally {
      setBusy(false)
    }
  }

  const profile = character.profile

  return (
    <section aria-labelledby="ai-bank-title" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Bot className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="ai-bank-title" className="text-lg font-semibold text-balance">
            Generar Banco de Voz mediante IA
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Sube una grabación de voz (.mp3 o .wav) desde la galería de tu celular. Analizamos su tono, rango, brillo,
            aire y vibrato para crear un perfil de canto asignado a{' '}
            <strong className="text-foreground">{character.name}</strong>.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/50 px-4 py-8 text-center hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
        >
          <Upload className="size-6 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">Subir audio desde la galería</span>
          <span className="text-xs text-muted-foreground">MP3, WAV, M4A · idealmente 10–60 s de voz limpia</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a"
          className="sr-only"
          tabIndex={-1}
          aria-label="Archivo de audio de voz"
          onChange={(e) => {
            const selected = e.target.files?.[0]
            if (selected) {
              if (previewUrl) URL.revokeObjectURL(previewUrl)
              setFile(selected)
              setPreviewUrl(URL.createObjectURL(selected))
              setProgress(0)
              setError(null)
            }
            e.target.value = ''
          }}
        />

        {file && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-sm">
              <FileAudio className="size-4 text-primary" aria-hidden="true" />
              <span className="truncate font-medium">{file.name}</span>
              <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            {previewUrl && (
              <audio controls src={previewUrl} className="h-10 w-full">
                <track kind="captions" />
              </audio>
            )}
            <button
              type="button"
              onClick={process}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-bold text-[#06121a] hover:brightness-110 disabled:opacity-60"
            >
              <Bot className="size-4" aria-hidden="true" />
              {busy ? 'Clonando voz…' : 'Clonar voz y crear perfil de canto'}
            </button>
          </div>
        )}

        {(busy || progress > 0) && (
          <div aria-live="polite">
            <ProgressBar value={progress} label={busy ? stage : 'Proceso completado'} />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {profile && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Perfil de canto activo</h3>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{profile.name}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['Tono base', `${profile.basePitchHz} Hz (${midiToName(Math.round(freqToMidi(profile.basePitchHz)))})`],
                ['Rango', `${profile.pitchRange[0]}–${profile.pitchRange[1]} Hz`],
                ['Formantes', `×${profile.formantShift}`],
                ['Brillo', `${Math.round(profile.brightness * 100)}%`],
                ['Aire', `${Math.round(profile.breathiness * 100)}%`],
                ['Vibrato', `${profile.vibratoRate} Hz · ${profile.vibratoDepth}¢`],
              ].map(([term, value]) => (
                <div key={term} className="rounded-lg bg-background/70 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{term}</dt>
                  <dd className="font-mono text-sm">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              El perfil ya se aplica al piano roll, a la pista base y a la optimización IA.
            </p>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Modo demo: las características acústicas se extraen realmente en tu navegador; el entrenamiento RVC /
          DiffSinger en el backend se simula. Tu audio nunca se guarda en el dispositivo.
        </p>
      </div>
    </section>
  )
}
