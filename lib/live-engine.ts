'use client'

import type * as ToneNS from 'tone'
import { midiToFreq } from './music'
import type { Note, VoiceProfile, Vowel } from './types'

type ToneModule = typeof ToneNS

/** Average adult formant frequencies (F1, F2, F3) in Hz. */
export const FORMANTS: Record<Vowel, [number, number, number]> = {
  a: [800, 1150, 2800],
  e: [400, 1700, 2600],
  i: [300, 2200, 3000],
  o: [450, 800, 2830],
  u: [325, 700, 2530],
}
export const FORMANT_Q: [number, number, number] = [6, 9, 12]
export const FORMANT_GAIN: [number, number, number] = [1, 0.55, 0.3]

export interface PlayEvent {
  midi: number
  start: number
  duration: number
  vowel: Vowel
}

class LiveEngine {
  private tone: ToneModule | null = null
  private synth: ToneNS.PolySynth | null = null
  private filters: ToneNS.Filter[] = []
  private vibrato: ToneNS.Vibrato | null = null
  private lowpass: ToneNS.Filter | null = null
  private part: ToneNS.Part<PlayEvent & { time: number }> | null = null
  private formantShift = 1
  private bpm = 120
  private playStartBeat = 0
  private starting: Promise<void> | null = null
  ready = false

  async start() {
    if (this.ready) return
    if (!this.starting) this.starting = this.boot()
    await this.starting
  }

  private async boot() {
    const Tone = await import('tone')
    // Must run inside a user gesture: unlocks the AudioContext on iOS / Android.
    await Tone.start()
    this.tone = Tone

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
      envelope: { attack: 0.04, decay: 0.15, sustain: 0.85, release: 0.35 },
      volume: -6,
    } as never)
    synth.maxPolyphony = 16

    const vibrato = new Tone.Vibrato({ frequency: 5.4, depth: 0.05 })
    const formantSum = new Tone.Gain(2.4)
    const dry = new Tone.Gain(0.07)
    const lowpass = new Tone.Filter(6500, 'lowpass')
    const reverb = new Tone.Freeverb({ roomSize: 0.62, dampening: 3200, wet: 0.16 })
    const limiter = new Tone.Limiter(-1)

    synth.connect(vibrato)
    this.filters = FORMANTS.a.map((freq, i) => {
      const filter = new Tone.Filter({ type: 'bandpass', frequency: freq, Q: FORMANT_Q[i] })
      const gain = new Tone.Gain(FORMANT_GAIN[i])
      vibrato.connect(filter)
      filter.connect(gain)
      gain.connect(formantSum)
      return filter
    })
    vibrato.connect(dry)
    dry.connect(formantSum)
    formantSum.chain(lowpass, reverb, limiter, Tone.getDestination())

    this.synth = synth
    this.vibrato = vibrato
    this.lowpass = lowpass
    this.ready = true
  }

  setProfile(profile: VoiceProfile | null) {
    this.formantShift = profile?.formantShift ?? 1
    if (this.vibrato) this.vibrato.depth.value = profile ? Math.min(0.2, profile.vibratoDepth / 400) : 0.05
    if (this.lowpass) this.lowpass.frequency.value = 3000 + (profile?.brightness ?? 0.7) * 5000
  }

  setVowel(vowel: Vowel, time?: number) {
    const formants = FORMANTS[vowel]
    this.filters.forEach((filter, i) => {
      filter.frequency.rampTo(formants[i] * this.formantShift, 0.04, time)
    })
  }

  noteOn(midi: number, vowel: Vowel) {
    if (!this.synth) return
    this.setVowel(vowel)
    this.synth.triggerAttack(midiToFreq(midi), undefined, 0.8)
  }

  noteOff(midi: number) {
    this.synth?.triggerRelease(midiToFreq(midi))
  }

  preview(midi: number, vowel: Vowel, seconds = 0.35) {
    if (!this.synth) return
    this.setVowel(vowel)
    this.synth.triggerAttackRelease(midiToFreq(midi), seconds, undefined, 0.7)
  }

  play(notes: (Note & { vowel: Vowel })[], bpm: number, fromBeat: number, onEnd: () => void) {
    const Tone = this.tone
    if (!Tone || !this.synth) return
    this.stop()
    this.bpm = bpm
    this.playStartBeat = fromBeat
    const secondsPerBeat = 60 / bpm
    const events = notes
      .filter((n) => n.start + n.duration > fromBeat)
      .map((n) => {
        const start = Math.max(n.start, fromBeat)
        return {
          time: (start - fromBeat) * secondsPerBeat,
          midi: n.midi,
          start,
          duration: (n.start + n.duration - start) * secondsPerBeat,
          vowel: n.vowel,
        }
      })
    const synth = this.synth
    this.part = new Tone.Part((time, ev) => {
      this.setVowel(ev.vowel, time)
      synth.triggerAttackRelease(midiToFreq(ev.midi), ev.duration, time, 0.8)
    }, events)
    this.part.start(0)

    const lastEnd = events.reduce((max, e) => Math.max(max, e.time + e.duration), 0)
    const transport = Tone.getTransport()
    transport.scheduleOnce((time) => {
      Tone.getDraw().schedule(onEnd, time)
    }, lastEnd + 0.4)
    transport.position = 0
    transport.start('+0.05')
  }

  stop() {
    const Tone = this.tone
    if (!Tone) return
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel()
    this.part?.dispose()
    this.part = null
    this.synth?.releaseAll()
  }

  positionBeats() {
    if (!this.tone) return this.playStartBeat
    return this.playStartBeat + (this.tone.getTransport().seconds * this.bpm) / 60
  }
}

export const liveEngine = new LiveEngine()
