'use client'

import { memo, useRef, useState } from 'react'
import { liveEngine } from '@/lib/live-engine'
import { KEYS_DESC } from '@/lib/music'
import { cn } from '@/lib/utils'
import { useStudio } from './studio-provider'

interface Props {
  width: number
  rowHeight: number
  rulerHeight: number
}

export const PianoKeys = memo(function PianoKeys({ width, rowHeight, rulerHeight }: Props) {
  const { audioReady, startAudio, guideVowel } = useStudio()
  const [active, setActive] = useState<number | null>(null)
  const lastTouchRef = useRef(0)

  const press = async (midi: number) => {
    if (!audioReady) await startAudio()
    setActive(midi)
    liveEngine.noteOn(midi, guideVowel)
  }

  const release = (midi: number) => {
    if (active !== midi) return
    setActive(null)
    liveEngine.noteOff(midi)
  }

  return (
    <div className="sticky left-0 z-20 shrink-0 bg-[#0a0d13]" style={{ width }}>
      <div
        className="sticky top-0 z-30 flex items-center justify-center border-b border-r border-border bg-[#0a0d13] font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        style={{ height: rulerHeight }}
      >
        88
      </div>
      {KEYS_DESC.map((key) => {
        const isActive = active === key.midi
        const isC = key.name.startsWith('C') && !key.isBlack
        return (
          <button
            key={key.midi}
            type="button"
            aria-label={`${key.name} (${key.solfege})`}
            className={cn(
              'relative block w-full border-b border-r border-[#1b2130] text-left outline-none focus-visible:ring-2 focus-visible:ring-primary',
              key.isBlack ? 'bg-[#d9dee8]' : 'bg-[#eef1f6]',
            )}
            style={{ height: rowHeight, touchAction: 'pan-y' }}
            onMouseDown={(e) => {
              if (e.button !== 0 || Date.now() - lastTouchRef.current < 700) return
              void press(key.midi)
            }}
            onMouseUp={() => release(key.midi)}
            onMouseLeave={() => release(key.midi)}
            onTouchStart={() => {
              lastTouchRef.current = Date.now()
              void press(key.midi)
            }}
            onTouchEnd={() => {
              lastTouchRef.current = Date.now()
              release(key.midi)
            }}
            onTouchCancel={() => release(key.midi)}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault()
                void press(key.midi)
              }
            }}
            onKeyUp={() => release(key.midi)}
          >
            {key.isBlack && (
              <span
                aria-hidden="true"
                className={cn('absolute inset-y-0 left-0 w-[62%] rounded-r-sm bg-[#151a24]', isActive && 'bg-accent')}
              />
            )}
            {!key.isBlack && isActive && <span aria-hidden="true" className="absolute inset-0 bg-primary/70" />}
            <span
              className={cn(
                'pointer-events-none absolute inset-y-0 right-1 flex items-center font-mono text-[9px] leading-none',
                isC ? 'font-bold text-[#0b0e14]' : 'text-[#5b6577]',
              )}
            >
              {key.name}
            </span>
          </button>
        )
      })}
    </div>
  )
})
