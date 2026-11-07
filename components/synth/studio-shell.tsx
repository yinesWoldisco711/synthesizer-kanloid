'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Bot, Piano, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AudioUnlockButton } from './audio-unlock-button'
import { CharacterManager } from './character-manager'
import { PianoRollTab } from './piano-roll-tab'
import { StudioProvider, useStudio } from './studio-provider'
import { VoicebankAi } from './voicebank-ai'

type Tab = 'roll' | 'ai' | 'characters'

const TABS: { id: Tab; label: string; short: string; icon: typeof Piano }[] = [
  { id: 'roll', label: 'Piano Roll', short: 'Piano Roll', icon: Piano },
  { id: 'ai', label: 'Crear Banco de Voz', short: 'Banco IA', icon: Bot },
  { id: 'characters', label: 'Gestión de Voicebanks y Personajes', short: 'Personajes', icon: Users },
]

function Header() {
  const { character } = useStudio()
  return (
    <header className="flex items-center justify-between gap-3 pt-14">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">KoeSynth Studio</p>
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Sintetizador de voz virtual</h1>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3">
        <span className="relative size-9 overflow-hidden rounded-full bg-secondary">
          {character.avatarUrl && (
            <Image
              src={character.avatarUrl}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
              unoptimized={character.avatarUrl.startsWith('data:')}
            />
          )}
        </span>
        <span className="max-w-28 truncate text-sm font-medium sm:max-w-40">{character.name}</span>
      </div>
    </header>
  )
}

function Studio() {
  const [tab, setTab] = useState<Tab>('roll')

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-4 px-3 pb-10 sm:px-6">
      <AudioUnlockButton />
      <Header />

      <nav
        role="tablist"
        aria-label="Secciones del sintetizador"
        className="sticky top-0 z-40 -mx-3 flex gap-1 overflow-x-auto border-b border-border bg-background/90 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-2"
      >
        {TABS.map(({ id, label, short, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      <div role="tabpanel" id="panel-roll" aria-labelledby="tab-roll" hidden={tab !== 'roll'}>
        <PianoRollTab />
      </div>
      <div role="tabpanel" id="panel-ai" aria-labelledby="tab-ai" hidden={tab !== 'ai'}>
        <VoicebankAi />
      </div>
      <div role="tabpanel" id="panel-characters" aria-labelledby="tab-characters" hidden={tab !== 'characters'}>
        <CharacterManager onOpenAi={() => setTab('ai')} />
      </div>
    </div>
  )
}

export function StudioShell() {
  return (
    <StudioProvider>
      <Studio />
    </StudioProvider>
  )
}
