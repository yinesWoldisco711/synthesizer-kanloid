'use client'

import { useState } from 'react'
import { AudioLines, Loader2, Sparkles } from 'lucide-react'
import { buildProjectJson, safeFileName } from '@/lib/project-file'
import { renderSong, toRenderResult } from '@/lib/renderer'
import type { RenderResult } from '@/lib/types'
import { AudioResult, ProgressBar } from './audio-result'
import { useStudio } from './studio-provider'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const AI_STAGES = [
  'Empaquetando notas (JSON) y audio base…',
  'Enviando paquete al servidor de inferencia…',
  'DiffSinger: prediciendo curvas de F0, vibrato y transiciones…',
  'Modelo acústico: afinación humana y respiraciones…',
  'Vocoder neuronal: renderizado de alta fidelidad…',
]

export function RenderPanel() {
  const { notes, bpm, bars, language, character, utauBank, baseRender, setBaseRender, aiRender, setAiRender } =
    useStudio()
  const [busy, setBusy] = useState<'base' | 'ai' | null>(null)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [payloadInfo, setPayloadInfo] = useState<string | null>(null)
  const [vibrato, setVibrato] = useState(70)
  const [breath, setBreath] = useState(60)
  const [error, setError] = useState<string | null>(null)

  const renderBase = async (onProgress: (ratio: number) => void): Promise<RenderResult> => {
    const buffer = await renderSong({
      notes,
      bpm,
      language,
      profile: character.profile,
      utau: utauBank,
      humanize: null,
      onProgress,
    })
    const result = toRenderResult(buffer, 'Pista base sintetizada')
    setBaseRender(result)
    return result
  }

  const handleBase = async () => {
    if (notes.length === 0) return setError('Añade al menos una nota al piano roll.')
    setError(null)
    setBusy('base')
    setStage('Sintetizando pista base desde el piano roll…')
    setProgress(0)
    try {
      await renderBase(setProgress)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al renderizar.')
    } finally {
      setBusy(null)
    }
  }

  const handleOptimize = async () => {
    if (notes.length === 0) return setError('Añade al menos una nota al piano roll.')
    setError(null)
    setBusy('ai')
    setProgress(0)
    try {
      setStage('Sintetizando pista base…')
      const base = await renderBase((r) => setProgress(r * 0.15))

      setStage(AI_STAGES[0])
      const score = JSON.stringify(buildProjectJson({ notes, bpm, bars, language, character }))
      const payload = new FormData()
      payload.append('score', new Blob([score], { type: 'application/json' }), 'score.json')
      payload.append('audio', base.blob, 'base.wav')
      setPayloadInfo(
        `Paquete: score.json (${(score.length / 1024).toFixed(1)} KB) + base.wav (${(base.blob.size / 1024 / 1024).toFixed(2)} MB)`,
      )
      await wait(500)
      setProgress(0.22)

      setStage(AI_STAGES[1])
      for (let i = 0; i < 6; i++) {
        await wait(150)
        setProgress(0.22 + i * 0.02)
      }

      setStage(AI_STAGES[2])
      await wait(600)
      setProgress(0.45)

      setStage(AI_STAGES[3])
      const buffer = await renderSong({
        notes,
        bpm,
        language,
        profile: character.profile,
        utau: utauBank,
        humanize: { vibrato: vibrato / 100, breath: breath / 100, pitchDrift: 1 },
        onProgress: (r) => setProgress(0.45 + r * 0.35),
      })

      setStage(AI_STAGES[4])
      for (let i = 0; i < 5; i++) {
        await wait(160)
        setProgress(0.8 + i * 0.04)
      }
      setAiRender(toRenderResult(buffer, 'Voz optimizada con IA (natural)'))
      setProgress(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en la optimización.')
    } finally {
      setBusy(null)
    }
  }

  const name = safeFileName(character.name)

  return (
    <section aria-labelledby="render-title" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 id="render-title" className="text-lg font-semibold text-balance">
          Renderizado y post-procesamiento
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Voz activa: <span className="text-foreground">{character.name}</span>
          {character.profile ? ' · perfil de canto IA' : ' · timbre de formantes por defecto'}
          {utauBank ? ` · UTAU “${utauBank.name}” (${utauBank.entries.length} alias)` : ''}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="flex justify-between text-muted-foreground">
            Intensidad de vibrato <span className="font-mono text-foreground">{vibrato}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={vibrato}
            onChange={(e) => setVibrato(Number(e.target.value))}
            className="accent-[var(--primary)]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="flex justify-between text-muted-foreground">
            Respiraciones <span className="font-mono text-foreground">{breath}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={breath}
            onChange={(e) => setBreath(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleBase}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold hover:bg-secondary/70 disabled:opacity-50"
        >
          {busy === 'base' ? <Loader2 className="size-4 animate-spin" /> : <AudioLines className="size-4" />}
          Renderizar pista base
        </button>
        <button
          type="button"
          onClick={handleOptimize}
          disabled={busy !== null}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3.5 text-base font-bold text-[#06121a] shadow-lg shadow-accent/20 hover:brightness-110 disabled:opacity-60"
        >
          {busy === 'ai' ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          Optimizar Voz con IA (Hacer Natural)
        </button>
      </div>

      {busy && (
        <div className="mt-4 flex flex-col gap-2" aria-live="polite">
          <ProgressBar value={progress} label={stage} />
          {busy === 'ai' && payloadInfo && <p className="font-mono text-xs text-muted-foreground">{payloadInfo}</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {(baseRender || aiRender) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {baseRender && <AudioResult result={baseRender} tone="primary" filename={`${name}-base.wav`} />}
          {aiRender && <AudioResult result={aiRender} tone="accent" filename={`${name}-ia-natural.wav`} />}
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Modo demo: la conexión con la red neuronal (DiffSinger / Hugging Face) se simula en el navegador. El paquete
        JSON + WAV se construye realmente y el post-procesado aplica vibrato con retardo, portamento entre notas,
        micro-desafinación humana, respiraciones y reverberación mediante DSP en memoria.
      </p>
    </section>
  )
}
