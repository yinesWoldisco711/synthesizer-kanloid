import type JSZip from 'jszip'

export type Language = 'es' | 'en' | 'ja' | 'zh'
export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u'

export interface Note {
  id: string
  midi: number
  /** Start position in quarter-note beats. */
  start: number
  /** Duration in quarter-note beats. */
  duration: number
  lyric: string
}

export interface VoiceProfile {
  id: string
  name: string
  sourceFile: string
  createdAt: string
  durationSec: number
  basePitchHz: number
  pitchRange: [number, number]
  formantShift: number
  brightness: number
  breathiness: number
  vibratoRate: number
  vibratoDepth: number
  engine: string
}

export interface OtoEntry {
  alias: string
  file: string
  offset: number
  consonant: number
  cutoff: number
  preutter: number
  overlap: number
}

export interface UtauBank {
  name: string
  sourceFile: string
  entries: OtoEntry[]
  aliasMap: Map<string, OtoEntry>
  wavCount: number
  baseMidi: number
  zip: JSZip
  bufferCache: Map<string, AudioBuffer>
}

export interface Character {
  name: string
  provider: string
  age: string
  gender: string
  description: string
  avatarUrl: string | null
  profile: VoiceProfile | null
}

export interface RenderResult {
  url: string
  blob: Blob
  duration: number
  peaks: number[]
  createdAt: number
  label: string
}
