import { MIDI_HIGH, MIDI_LOW, midiToName } from './music'
import { getVowel } from './phonetics'
import type { Character, Language, Note } from './types'

export const PROJECT_FORMAT = 'koesynth-score'

export function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function buildProjectJson(params: {
  notes: Note[]
  bpm: number
  bars: number
  language: Language
  character: Character
}) {
  const { notes, bpm, bars, language, character } = params
  const spb = 60 / bpm
  return {
    format: PROJECT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    compatibility: ['vocaloid-like', 'utau-like'],
    tempo: { bpm, timeSignature: [4, 4] },
    bars,
    language,
    character: {
      name: character.name,
      provider: character.provider,
      age: character.age,
      gender: character.gender,
      description: character.description,
      profile: character.profile,
    },
    notes: [...notes]
      .sort((a, b) => a.start - b.start)
      .map((n) => ({
        id: n.id,
        pitch: n.midi,
        noteName: midiToName(n.midi),
        startBeat: n.start,
        durationBeats: n.duration,
        startSeconds: Number((n.start * spb).toFixed(4)),
        durationSeconds: Number((n.duration * spb).toFixed(4)),
        lyric: n.lyric,
        vowel: getVowel(n.lyric, language),
      })),
  }
}

export interface ParsedProject {
  notes: Note[]
  bpm: number
  bars: number
  language: Language
  character: Partial<Character> | null
}

export function parseProjectJson(text: string): ParsedProject {
  const data = JSON.parse(text)
  if (!data || !Array.isArray(data.notes)) throw new Error('El archivo no contiene una partitura válida.')
  const language: Language = ['es', 'en', 'ja', 'zh'].includes(data.language) ? data.language : 'es'
  const notes: Note[] = data.notes
    .map((n: Record<string, unknown>) => ({
      id: typeof n.id === 'string' ? n.id : newId(),
      midi: Math.round(Number(n.pitch ?? n.midi)),
      start: Number(n.startBeat ?? n.start),
      duration: Number(n.durationBeats ?? n.duration),
      lyric: String(n.lyric ?? ''),
    }))
    .filter(
      (n: Note) =>
        Number.isFinite(n.midi) &&
        n.midi >= MIDI_LOW &&
        n.midi <= MIDI_HIGH &&
        Number.isFinite(n.start) &&
        n.start >= 0 &&
        Number.isFinite(n.duration) &&
        n.duration > 0,
    )
  const bpm = Math.min(300, Math.max(30, Number(data.tempo?.bpm ?? data.bpm) || 120))
  const lastBeat = notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0)
  const bars = Math.max(Number(data.bars) || 16, Math.ceil(lastBeat / 4) + 1)
  return { notes, bpm, bars: Math.min(256, bars), language, character: data.character ?? null }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function safeFileName(name: string) {
  return (name || 'proyecto').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60)
}
