'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { liveEngine } from '@/lib/live-engine'
import { newId } from '@/lib/project-file'
import type { Character, Language, Note, RenderResult, UtauBank, Vowel } from '@/lib/types'

const DEMO: [number, number, number, string][] = [
  [67, 0, 1, 'Can'],
  [69, 1, 1, 'ta'],
  [71, 2, 1, 'con'],
  [72, 3, 1, 'mi'],
  [71, 4, 2, 'go'],
  [67, 6, 1.5, 'a'],
  [64, 8, 1, 'la'],
  [65, 9, 1, 'luz'],
  [67, 10, 1, 'de'],
  [69, 11, 1, 'la'],
  [67, 12, 3, 'lu'],
  [64, 15, 1, 'na'],
]

const DEFAULT_CHARACTER: Character = {
  name: 'Koe Aoi',
  provider: 'Voz demo KoeSynth',
  age: '17',
  gender: 'Femenino',
  description: 'Cantante virtual de timbre brillante y cálido. Ideal para pop, J-pop y baladas.',
  avatarUrl: '/images/default-singer.png',
  profile: null,
}

interface StudioContextValue {
  notes: Note[]
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  bpm: number
  setBpm: (bpm: number) => void
  bars: number
  setBars: (bars: number) => void
  language: Language
  setLanguage: (language: Language) => void
  guideVowel: Vowel
  setGuideVowel: (vowel: Vowel) => void
  cursorBeat: number
  setCursorBeat: (beat: number) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  character: Character
  updateCharacter: (patch: Partial<Character>) => void
  utauBank: UtauBank | null
  setUtauBank: (bank: UtauBank | null) => void
  audioReady: boolean
  startAudio: () => Promise<void>
  baseRender: RenderResult | null
  setBaseRender: (render: RenderResult | null) => void
  aiRender: RenderResult | null
  setAiRender: (render: RenderResult | null) => void
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(() =>
    DEMO.map(([midi, start, duration, lyric]) => ({ id: newId(), midi, start, duration, lyric })),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bpm, setBpm] = useState(110)
  const [bars, setBars] = useState(32)
  const [language, setLanguage] = useState<Language>('es')
  const [guideVowel, setGuideVowel] = useState<Vowel>('a')
  const [cursorBeat, setCursorBeat] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [character, setCharacter] = useState<Character>(DEFAULT_CHARACTER)
  const [utauBank, setUtauBank] = useState<UtauBank | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [baseRender, setBaseRenderState] = useState<RenderResult | null>(null)
  const [aiRender, setAiRenderState] = useState<RenderResult | null>(null)

  const updateCharacter = useCallback((patch: Partial<Character>) => {
    setCharacter((prev) => ({ ...prev, ...patch }))
  }, [])

  const startAudio = useCallback(async () => {
    await liveEngine.start()
    setAudioReady(true)
  }, [])

  const setBaseRender = useCallback((render: RenderResult | null) => {
    setBaseRenderState((prev) => {
      if (prev && prev.url !== render?.url) URL.revokeObjectURL(prev.url)
      return render
    })
  }, [])

  const setAiRender = useCallback((render: RenderResult | null) => {
    setAiRenderState((prev) => {
      if (prev && prev.url !== render?.url) URL.revokeObjectURL(prev.url)
      return render
    })
  }, [])

  useEffect(() => {
    if (audioReady) liveEngine.setProfile(character.profile)
  }, [audioReady, character.profile])

  const value = useMemo<StudioContextValue>(
    () => ({
      notes,
      setNotes,
      selectedId,
      setSelectedId,
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
      character,
      updateCharacter,
      utauBank,
      setUtauBank,
      audioReady,
      startAudio,
      baseRender,
      setBaseRender,
      aiRender,
      setAiRender,
    }),
    [
      notes,
      selectedId,
      bpm,
      bars,
      language,
      guideVowel,
      cursorBeat,
      isPlaying,
      character,
      updateCharacter,
      utauBank,
      audioReady,
      startAudio,
      baseRender,
      setBaseRender,
      aiRender,
      setAiRender,
    ],
  )

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used within StudioProvider')
  return ctx
}
