'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { liveEngine } from '@/lib/live-engine'
import { KEYS_DESC, MIDI_HIGH, MIDI_LOW, midiToName } from '@/lib/music'
import { getVowel, LANGUAGES } from '@/lib/phonetics'
import { newId } from '@/lib/project-file'
import type { Note } from '@/lib/types'
import { LyricEditor } from './lyric-editor'
import { PianoKeys } from './piano-keys'
import { useStudio } from './studio-provider'

const ROW_H = 20
const RULER_H = 26
const GRID_H = RULER_H + KEYS_DESC.length * ROW_H

const COLORS = {
  bg: '#0c0f15',
  rowWhite: '#121722',
  rowBlack: '#0d1119',
  rowC: '#2a3344',
  sub: '#161c28',
  beat: '#1f2736',
  bar: '#34405a',
  ruler: '#0a0d13',
  rulerText: '#8b96ad',
  note: '#22d3ee',
  noteBorder: '#0e7490',
  noteText: '#04222a',
  selected: '#f472b6',
  selectedBorder: '#fbcfe8',
  playhead: '#f472b6',
  cursor: '#fbbf24',
}

interface DragState {
  id: string
  pointerId: number
  mode: 'move' | 'resize'
  startBeat: number
  startRow: number
  origin: Note
}

interface Props {
  beatWidth: number
  snap: number
}

export function PianoRoll({ beatWidth, snap }: Props) {
  const {
    notes,
    setNotes,
    selectedId,
    setSelectedId,
    bars,
    language,
    cursorBeat,
    setCursorBeat,
    isPlaying,
    audioReady,
    startAudio,
  } = useStudio()

  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const lastTapRef = useRef({ t: 0, x: 0, y: 0 })
  const consumeTouchRef = useRef(false)
  const playheadRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [keyWidth, setKeyWidth] = useState(68)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 })

  const stateRef = useRef({ notes, selectedId, beatWidth, snap, cursorBeat, size })
  stateRef.current = { notes, selectedId, beatWidth, snap, cursorBeat, size }

  const gridWidth = Math.max(bars * 4 * beatWidth, size.w)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const scroller = scrollRef.current
    const { notes, selectedId, beatWidth, snap, cursorBeat, size } = stateRef.current
    if (!canvas || !scroller || size.w === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== Math.round(size.w * dpr) || canvas.height !== Math.round(size.h * dpr)) {
      canvas.width = Math.round(size.w * dpr)
      canvas.height = Math.round(size.h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sx = scroller.scrollLeft
    const sy = scroller.scrollTop
    const { w, h } = size

    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)

    const firstRow = Math.max(0, Math.floor((sy - RULER_H) / ROW_H))
    const lastRow = Math.min(KEYS_DESC.length - 1, Math.ceil((sy + h) / ROW_H))
    for (let r = firstRow; r <= lastRow; r++) {
      const key = KEYS_DESC[r]
      const y = RULER_H + r * ROW_H - sy
      ctx.fillStyle = key.isBlack ? COLORS.rowBlack : COLORS.rowWhite
      ctx.fillRect(0, y, w, ROW_H)
      ctx.fillStyle = key.name.startsWith('C') && !key.isBlack ? COLORS.rowC : COLORS.sub
      ctx.fillRect(0, y + ROW_H - 1, w, 1)
    }

    const startBeat = Math.floor(sx / beatWidth / snap) * snap
    const endBeat = (sx + w) / beatWidth
    for (let b = startBeat; b <= endBeat; b += snap) {
      const x = Math.round(b * beatWidth - sx) + 0.5
      const isBar = Math.abs(b % 4) < 1e-6
      const isBeat = Math.abs(b % 1) < 1e-6
      ctx.fillStyle = isBar ? COLORS.bar : isBeat ? COLORS.beat : COLORS.sub
      ctx.fillRect(x, RULER_H, isBar ? 1.5 : 1, h)
    }

    ctx.font = '600 11px system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    for (const note of notes) {
      const x = note.start * beatWidth - sx
      const width = note.duration * beatWidth
      const y = RULER_H + (MIDI_HIGH - note.midi) * ROW_H - sy
      if (x + width < 0 || x > w || y + ROW_H < RULER_H || y > h) continue
      const selected = note.id === selectedId
      ctx.fillStyle = selected ? COLORS.selected : COLORS.note
      ctx.strokeStyle = selected ? COLORS.selectedBorder : COLORS.noteBorder
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(x + 1, y + 1, Math.max(4, width - 2), ROW_H - 2, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(4,34,42,0.35)'
      ctx.fillRect(x + width - 6, y + 5, 2, ROW_H - 10)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 4, y, Math.max(0, width - 12), ROW_H)
      ctx.clip()
      ctx.fillStyle = COLORS.noteText
      ctx.fillText(note.lyric || '·', x + 6, y + ROW_H / 2 + 0.5)
      ctx.restore()
    }

    const drawLine = (beat: number, color: string) => {
      const x = Math.round(beat * beatWidth - sx) + 0.5
      if (x < 0 || x > w) return
      ctx.fillStyle = color
      ctx.fillRect(x - 1, 0, 2, h)
    }
    drawLine(cursorBeat, COLORS.cursor)
    if (playheadRef.current !== null) drawLine(playheadRef.current, COLORS.playhead)

    ctx.fillStyle = COLORS.ruler
    ctx.fillRect(0, 0, w, RULER_H)
    ctx.fillStyle = COLORS.bar
    ctx.fillRect(0, RULER_H - 1, w, 1)
    ctx.font = '600 11px ui-monospace, monospace'
    for (let b = Math.floor(sx / beatWidth); b <= endBeat; b++) {
      const x = b * beatWidth - sx
      if (b % 4 === 0) {
        ctx.fillStyle = COLORS.rulerText
        ctx.fillText(String(b / 4 + 1), x + 4, RULER_H / 2)
        ctx.fillStyle = COLORS.bar
        ctx.fillRect(x, 6, 1, RULER_H - 6)
      } else {
        ctx.fillStyle = COLORS.beat
        ctx.fillRect(x, RULER_H - 8, 1, 8)
      }
    }
    const cursorX = cursorBeat * beatWidth - sx
    ctx.fillStyle = COLORS.cursor
    ctx.beginPath()
    ctx.moveTo(cursorX - 6, 0)
    ctx.lineTo(cursorX + 6, 0)
    ctx.lineTo(cursorX, 9)
    ctx.fill()
  }, [])

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      draw()
    })
  }, [draw])

  useEffect(() => {
    scheduleDraw()
  }, [notes, selectedId, beatWidth, snap, cursorBeat, size, scheduleDraw])

  useLayoutEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const media = window.matchMedia('(max-width: 640px)')
    const updateKeys = () => setKeyWidth(media.matches ? 52 : 68)
    updateKeys()
    media.addEventListener('change', updateKeys)
    const observer = new ResizeObserver(() => {
      setSize({ w: Math.max(0, scroller.clientWidth - (media.matches ? 52 : 68)), h: scroller.clientHeight })
    })
    observer.observe(scroller)
    // Start roughly around C4–C5 so the demo melody is visible.
    scroller.scrollTop = RULER_H + (MIDI_HIGH - 79) * ROW_H
    return () => {
      observer.disconnect()
      media.removeEventListener('change', updateKeys)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      playheadRef.current = null
      scheduleDraw()
      return
    }
    let frame = 0
    const tick = () => {
      const beat = liveEngine.positionBeats()
      playheadRef.current = beat
      const scroller = scrollRef.current
      const { beatWidth, size } = stateRef.current
      if (scroller) {
        const x = beat * beatWidth
        if (x > scroller.scrollLeft + size.w * 0.85 || x < scroller.scrollLeft) {
          scroller.scrollLeft = Math.max(0, x - size.w * 0.15)
        }
      }
      draw()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, draw, scheduleDraw])

  const locate = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const scroller = scrollRef.current!
    const rect = canvas.getBoundingClientRect()
    const cx = clientX - rect.left
    const cy = clientY - rect.top
    const gx = cx + scroller.scrollLeft
    const gy = cy + scroller.scrollTop
    return {
      cx,
      cy,
      gx,
      beat: gx / stateRef.current.beatWidth,
      row: Math.floor((gy - RULER_H) / ROW_H),
      inRuler: cy < RULER_H,
      gy,
    }
  }, [])

  const hitTest = useCallback((gx: number, gy: number, touch: boolean) => {
    const { notes, beatWidth } = stateRef.current
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i]
      const x = n.start * beatWidth
      const width = n.duration * beatWidth
      const y = RULER_H + (MIDI_HIGH - n.midi) * ROW_H
      if (gx >= x && gx <= x + width && gy >= y && gy <= y + ROW_H) {
        const edge = Math.min(touch ? 16 : 9, width / 2.5)
        return { note: n, resize: gx >= x + width - edge }
      }
    }
    return null
  }, [])

  const previewNote = useCallback(
    async (midi: number, lyric: string) => {
      if (!audioReady) await startAudio()
      liveEngine.preview(midi, getVowel(lyric, language))
    },
    [audioReady, startAudio, language],
  )

  const snapValue = (value: number) => Math.round(value / stateRef.current.snap) * stateRef.current.snap

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const touch = event.pointerType !== 'mouse'
    const p = locate(event.clientX, event.clientY)
    consumeTouchRef.current = false

    if (p.inRuler) {
      consumeTouchRef.current = true
      setCursorBeat(Math.max(0, snapValue(p.beat)))
      return
    }

    const hit = hitTest(p.gx, p.gy, touch)
    const now = performance.now()
    const last = lastTapRef.current
    const isDouble = now - last.t < 380 && Math.hypot(p.cx - last.x, p.cy - last.y) < 26
    lastTapRef.current = isDouble ? { t: 0, x: 0, y: 0 } : { t: now, x: p.cx, y: p.cy }

    if (isDouble) {
      consumeTouchRef.current = true
      event.preventDefault()
      if (hit) {
        setSelectedId(hit.note.id)
        setEditingId(hit.note.id)
        return
      }
      const midi = MIDI_HIGH - p.row
      if (midi < MIDI_LOW || midi > MIDI_HIGH) return
      const lyric = LANGUAGES.find((l) => l.value === language)?.defaultLyric ?? 'la'
      const note: Note = {
        id: newId(),
        midi,
        start: Math.max(0, Math.floor(p.beat / stateRef.current.snap) * stateRef.current.snap),
        duration: Math.max(stateRef.current.snap, 1),
        lyric,
      }
      setNotes((prev) => [...prev, note])
      setSelectedId(note.id)
      void previewNote(midi, lyric)
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        id: note.id,
        pointerId: event.pointerId,
        mode: 'resize',
        startBeat: note.start + note.duration,
        startRow: p.row,
        origin: note,
      }
      return
    }

    if (hit) {
      consumeTouchRef.current = true
      setSelectedId(hit.note.id)
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        id: hit.note.id,
        pointerId: event.pointerId,
        mode: hit.resize ? 'resize' : 'move',
        startBeat: p.beat,
        startRow: p.row,
        origin: hit.note,
      }
      if (!hit.resize) void previewNote(hit.note.midi, hit.note.lyric)
    } else {
      setSelectedId(null)
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const p = locate(event.clientX, event.clientY)
    if (!drag || drag.pointerId !== event.pointerId) {
      if (event.pointerType === 'mouse') {
        const hit = p.inRuler ? null : hitTest(p.gx, p.gy, false)
        event.currentTarget.style.cursor = p.inRuler ? 'pointer' : hit ? (hit.resize ? 'ew-resize' : 'grab') : 'crosshair'
      }
      return
    }
    const { snap } = stateRef.current
    const origin = drag.origin
    if (drag.mode === 'move') {
      const start = Math.max(0, snapValue(origin.start + (p.beat - drag.startBeat)))
      const midi = Math.min(MIDI_HIGH, Math.max(MIDI_LOW, origin.midi - (p.row - drag.startRow)))
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== drag.id) return n
          if (n.midi !== midi) liveEngine.preview(midi, getVowel(n.lyric, language), 0.2)
          return n.start === start && n.midi === midi ? n : { ...n, start, midi }
        }),
      )
    } else {
      const end = snapValue(origin.start + origin.duration + (p.beat - drag.startBeat))
      const duration = Math.max(snap, end - origin.start)
      setNotes((prev) => prev.map((n) => (n.id === drag.id && n.duration !== duration ? { ...n, duration } : n)))
    }
  }

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Non-passive listener: block page scroll only when the touch edits a note.
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      const p = locate(touch.clientX, touch.clientY)
      if (consumeTouchRef.current || p.inRuler || hitTest(p.gx, p.gy, true)) event.preventDefault()
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => canvas.removeEventListener('touchstart', onTouchStart)
  }, [locate, hitTest])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        setNotes((prev) => prev.filter((n) => n.id !== selectedId))
        setSelectedId(null)
      } else if (event.key === 'Enter' && selectedId) {
        event.preventDefault()
        setEditingId(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, setNotes, setSelectedId])

  const editingNote = notes.find((n) => n.id === editingId) ?? null

  const handleScroll = () => {
    const scroller = scrollRef.current
    if (scroller) setScrollPos({ x: scroller.scrollLeft, y: scroller.scrollTop })
    draw()
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative h-[58vh] min-h-[360px] overflow-auto overscroll-contain rounded-xl border border-border bg-[#0c0f15] md:h-[62vh]"
        role="application"
        aria-label="Piano roll de 88 teclas. Doble clic o doble toque para crear una nota."
      >
        <div className="flex" style={{ width: keyWidth + gridWidth, height: GRID_H }}>
          <PianoKeys width={keyWidth} rowHeight={ROW_H} rulerHeight={RULER_H} />
          <div className="relative shrink-0" style={{ width: gridWidth, height: GRID_H }}>
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onContextMenu={(e) => e.preventDefault()}
              className="sticky top-0 block select-none"
              style={{ left: keyWidth, width: size.w, height: size.h, touchAction: 'pan-x pan-y' }}
            />
          </div>
        </div>
      </div>

      {editingNote && (
        <LyricEditor
          note={editingNote}
          left={keyWidth + editingNote.start * beatWidth - scrollPos.x}
          top={RULER_H + (MIDI_HIGH - editingNote.midi + 1) * ROW_H - scrollPos.y + 6}
          maxWidth={keyWidth + size.w}
          onClose={() => setEditingId(null)}
          onNext={(currentId) => {
            const sorted = [...notes].sort((a, b) => a.start - b.start || b.midi - a.midi)
            const index = sorted.findIndex((n) => n.id === currentId)
            const next = sorted[index + 1]
            if (next) {
              setSelectedId(next.id)
              setEditingId(next.id)
              const scroller = scrollRef.current
              if (scroller) {
                const x = next.start * beatWidth
                if (x > scroller.scrollLeft + size.w - 120) scroller.scrollLeft = x - 80
              }
            } else {
              setEditingId(null)
            }
          }}
        />
      )}
      <p className="sr-only" aria-live="polite">
        {selectedId
          ? `Nota seleccionada ${midiToName(notes.find((n) => n.id === selectedId)?.midi ?? 60)}`
          : 'Ninguna nota seleccionada'}
      </p>
    </div>
  )
}
