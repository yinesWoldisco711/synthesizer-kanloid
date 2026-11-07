'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Bot, Download, FileArchive, FileJson, ImagePlus, Upload, UserRound } from 'lucide-react'
import { downloadBlob, safeFileName } from '@/lib/project-file'
import { exportVoicebankZip, importUtauZip } from '@/lib/utau'
import { midiToName } from '@/lib/music'
import type { Character } from '@/lib/types'
import { ProgressBar } from './audio-result'
import { useStudio } from './studio-provider'

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 sm:text-sm'

const buttonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50'

export function CharacterManager({ onOpenAi }: { onOpenAi: () => void }) {
  const { character, updateCharacter, utauBank, setUtauBank } = useStudio()
  const avatarRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLInputElement>(null)
  const [zipProgress, setZipProgress] = useState<number | null>(null)
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [exporting, setExporting] = useState(false)

  const field = (key: keyof Character, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={(character[key] as string) ?? ''}
        onChange={(e) => updateCharacter({ [key]: e.target.value })}
        className={inputClass}
        {...props}
      />
    </label>
  )

  const handleAvatar = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => updateCharacter({ avatarUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const handleZip = async (file: File) => {
    setStatus(null)
    setZipProgress(0)
    try {
      const bank = await importUtauZip(file, setZipProgress)
      setUtauBank(bank)
      if (!character.name || character.name === 'Koe Aoi') updateCharacter({ name: bank.name })
      setStatus({ type: 'ok', text: `Voicebank UTAU “${bank.name}” cargado: ${bank.entries.length} alias, ${bank.wavCount} WAV.` })
    } catch (e) {
      setStatus({ type: 'error', text: e instanceof Error ? e.message : 'No se pudo leer el .zip.' })
    } finally {
      setZipProgress(null)
    }
  }

  const exportZip = async () => {
    setExporting(true)
    try {
      const blob = await exportVoicebankZip(character, utauBank)
      downloadBlob(blob, `${safeFileName(character.name)}-voicebank.zip`)
    } finally {
      setExporting(false)
    }
  }

  const exportSheet = () => {
    const blob = new Blob([JSON.stringify({ format: 'koesynth-character', version: 1, character }, null, 2)], {
      type: 'application/json',
    })
    downloadBlob(blob, `${safeFileName(character.name)}-ficha.json`)
  }

  const importSheet = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      const imported = (data.character ?? data) as Partial<Character>
      if (typeof imported.name !== 'string') throw new Error('La ficha no tiene un nombre válido.')
      updateCharacter({
        name: imported.name,
        provider: imported.provider ?? '',
        age: imported.age ?? '',
        gender: imported.gender ?? '',
        description: imported.description ?? '',
        avatarUrl: imported.avatarUrl ?? character.avatarUrl,
        profile: imported.profile ?? null,
      })
      setStatus({ type: 'ok', text: `Ficha de “${imported.name}” importada.` })
    } catch (e) {
      setStatus({ type: 'error', text: e instanceof Error ? e.message : 'Ficha no válida.' })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <section aria-labelledby="sheet-title" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 id="sheet-title" className="flex items-center gap-2 text-lg font-semibold">
            <UserRound className="size-5 text-primary" aria-hidden="true" /> Crear Ficha de Personaje
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {field('name', 'Nombre del Banco de Voz', { placeholder: 'ej. Koe Aoi', required: true })}
            {field('provider', 'Proveedor de voz', { placeholder: 'Nombre de quien presta la voz' })}
            {field('age', 'Edad', { inputMode: 'numeric', placeholder: '17' })}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Género</span>
              <select
                value={character.gender}
                onChange={(e) => updateCharacter({ gender: e.target.value })}
                className={inputClass}
              >
                {['Femenino', 'Masculino', 'No binario', 'Andrógino', 'Otro'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="text-muted-foreground">Descripción del personaje</span>
              <textarea
                value={character.description}
                onChange={(e) => updateCharacter({ description: e.target.value })}
                rows={4}
                className={inputClass}
                placeholder="Personalidad, estilo musical, timbre…"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => avatarRef.current?.click()}>
              <ImagePlus className="size-4" /> Importar imagen de la galería
            </button>
            <button type="button" className={buttonClass} onClick={exportSheet}>
              <FileJson className="size-4" /> Exportar ficha
            </button>
            <button type="button" className={buttonClass} onClick={() => sheetRef.current?.click()}>
              <Upload className="size-4" /> Importar ficha
            </button>
          </div>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-label="Imagen del personaje"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleAvatar(file)
              e.target.value = ''
            }}
          />
          <input
            ref={sheetRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Importar ficha JSON"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importSheet(file)
              e.target.value = ''
            }}
          />
        </section>

        <section aria-labelledby="utau-title" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 id="utau-title" className="flex items-center gap-2 text-lg font-semibold">
            <FileArchive className="size-5 text-primary" aria-hidden="true" /> Voicebanks UTAU / Vocaloid
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Importa un voicebank UTAU comprimido (.zip con archivos .wav y oto.ini). Las sílabas del piano roll que
            coincidan con un alias se cantarán con las muestras reales del banco.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => zipRef.current?.click()}
              disabled={zipProgress !== null}
            >
              <Upload className="size-4" /> Importar voicebank (.zip)
            </button>
            <button type="button" className={buttonClass} onClick={exportZip} disabled={exporting}>
              <Download className="size-4" /> {exporting ? 'Empaquetando…' : 'Exportar voicebank (.zip)'}
            </button>
            {utauBank && (
              <button type="button" className={buttonClass} onClick={() => setUtauBank(null)}>
                Quitar banco UTAU
              </button>
            )}
          </div>
          <input
            ref={zipRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="sr-only"
            tabIndex={-1}
            aria-label="Voicebank UTAU en .zip"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleZip(file)
              e.target.value = ''
            }}
          />
          {zipProgress !== null && (
            <div className="mt-4">
              <ProgressBar value={zipProgress} label="Leyendo oto.ini…" />
            </div>
          )}
          {utauBank && (
            <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{utauBank.name}</p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Tono de grabación
                  <select
                    value={utauBank.baseMidi}
                    onChange={(e) => setUtauBank({ ...utauBank, baseMidi: Number(e.target.value) })}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  >
                    {Array.from({ length: 25 }, (_, i) => 48 + i).map((m) => (
                      <option key={m} value={m}>
                        {midiToName(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {utauBank.entries.length} alias · {utauBank.wavCount} archivos WAV · {utauBank.sourceFile}
              </p>
              <div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                {utauBank.entries.slice(0, 120).map((entry, i) => (
                  <span key={`${entry.alias}-${i}`} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                    {entry.alias}
                  </span>
                ))}
              </div>
            </div>
          )}
          {status && (
            <p
              role={status.type === 'error' ? 'alert' : 'status'}
              className={`mt-3 text-sm ${status.type === 'error' ? 'text-destructive' : 'text-primary'}`}
            >
              {status.text}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Para partituras (notas, letras y tiempos) usa Importar / Exportar JSON en la pestaña Piano Roll: ocupan solo
            unos KB.
          </p>
        </section>

        <button
          type="button"
          onClick={onOpenAi}
          className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-left hover:bg-primary/10"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bot className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold">🤖 Generar Banco de Voz mediante IA</span>
            <span className="block text-sm text-muted-foreground">
              Clona una voz desde un audio de tu galería y asígnala a este personaje.
            </span>
          </span>
        </button>
      </div>

      <aside aria-label="Vista previa de la ficha" className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative aspect-square bg-gradient-to-br from-primary/20 to-accent/20">
            {character.avatarUrl ? (
              <Image
                src={character.avatarUrl}
                alt={`Ilustración oficial de ${character.name}`}
                fill
                sizes="(max-width: 1024px) 100vw, 340px"
                className="object-cover"
                unoptimized={character.avatarUrl.startsWith('data:')}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">Sin imagen</div>
            )}
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Ficha de personaje</p>
            <h3 className="mt-1 text-xl font-bold text-balance">{character.name || 'Sin nombre'}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Proveedor</dt>
                <dd className="truncate">{character.provider || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Edad · Género</dt>
                <dd>
                  {character.age || '—'} · {character.gender || '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Motor de voz</dt>
                <dd>
                  {utauBank ? `UTAU (${utauBank.entries.length} alias)` : 'Formantes KoeSynth'}
                  {character.profile ? ' + perfil IA' : ''}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{character.description}</p>
          </div>
        </div>
      </aside>
    </div>
  )
}
