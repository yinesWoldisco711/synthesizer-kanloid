'use client'

import { FORMANTS, FORMANT_GAIN, FORMANT_Q } from './live-engine'
import { midiToFreq } from './music'
import { getVowel, startsWithConsonant } from './phonetics'
import { findOtoEntry, getSampleBuffer } from './utau'
import type { Language, Note, RenderResult, UtauBank, VoiceProfile } from './types'

export interface HumanizeOptions {
  vibrato: number
  breath: number
  pitchDrift: number
}

export interface RenderOptions {
  notes: Note[]
  bpm: number
  language: Language
  profile: VoiceProfile | null
  utau: UtauBank | null
  humanize: HumanizeOptions | null
  onProgress?: (ratio: number) => void
}

const SAMPLE_RATE = 44100

function createNoiseBuffer(ctx: BaseAudioContext, seconds = 2) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function createImpulse(ctx: BaseAudioContext, seconds = 2.2, decay = 3.2) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return impulse
}

function noiseBurst(
  ctx: BaseAudioContext,
  noise: AudioBuffer,
  destination: AudioNode,
  time: number,
  options: { duration: number; level: number; frequency: number; q: number },
) {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = options.frequency
  filter.Q.value = options.q
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(options.level, time + options.duration * 0.4)
  gain.gain.linearRampToValueAtTime(0, time + options.duration)
  src.connect(filter).connect(gain).connect(destination)
  src.start(time, Math.random())
  src.stop(time + options.duration + 0.02)
}

export async function renderSong(opts: RenderOptions): Promise<AudioBuffer> {
  const { bpm, language, profile, utau, humanize } = opts
  const notes = [...opts.notes].sort((a, b) => a.start - b.start)
  const spb = 60 / bpm
  const lead = humanize ? 0.6 : 0.2
  const lastEnd = notes.reduce((max, n) => Math.max(max, (n.start + n.duration) * spb), 0.5)
  const ctx = new OfflineAudioContext(2, Math.ceil((lastEnd + lead + 2.6) * SAMPLE_RATE), SAMPLE_RATE)

  const shift = profile?.formantShift ?? 1
  const brightness = profile?.brightness ?? 0.7
  const breathiness = profile?.breathiness ?? 0.15

  const voiceBus = ctx.createGain()
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 3000 + brightness * 5000
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -18
  compressor.ratio.value = 3
  voiceBus.connect(lowpass).connect(compressor).connect(ctx.destination)

  const reverb = ctx.createConvolver()
  reverb.buffer = createImpulse(ctx, humanize ? 2.4 : 1.2)
  const reverbGain = ctx.createGain()
  reverbGain.gain.value = humanize ? 0.28 : 0.08
  lowpass.connect(reverb).connect(reverbGain).connect(compressor)

  const noise = createNoiseBuffer(ctx)

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    const prev = notes[i - 1]
    const jitter = humanize ? (Math.random() - 0.5) * 0.02 * humanize.pitchDrift : 0
    const t0 = lead + note.start * spb + jitter
    const duration = note.duration * spb
    const release = humanize ? 0.14 : 0.06
    const attack = humanize ? 0.05 : 0.02
    const velocity = humanize ? 0.42 + Math.random() * 0.12 : 0.5
    const freq = midiToFreq(note.midi)
    const vowel = getVowel(note.lyric, language)
    const gapBefore = prev ? (note.start - (prev.start + prev.duration)) * spb : Infinity

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(velocity, t0 + attack)
    env.gain.setValueAtTime(velocity * (humanize ? 0.9 : 1), Math.max(t0 + attack, t0 + duration - 0.02))
    env.gain.linearRampToValueAtTime(0, t0 + duration + release)
    env.connect(voiceBus)

    const detuneTargets: AudioParam[] = []
    const entry = utau ? findOtoEntry(utau, note.lyric) : null
    const sample = utau && entry ? await getSampleBuffer(utau, entry) : null

    if (utau && entry && sample) {
      const src = ctx.createBufferSource()
      src.buffer = sample
      src.playbackRate.value = freq / midiToFreq(utau.baseMidi)
      const offset = entry.offset / 1000
      const loopStart = offset + entry.consonant / 1000
      const loopEnd = entry.cutoff < 0 ? offset - entry.cutoff / 1000 : sample.duration - entry.cutoff / 1000
      if (loopEnd - loopStart > 0.05) {
        src.loop = true
        src.loopStart = loopStart
        src.loopEnd = loopEnd
      }
      const sampleGain = ctx.createGain()
      sampleGain.gain.value = 1.6
      src.connect(sampleGain).connect(env)
      if (src.detune) detuneTargets.push(src.detune)
      src.start(t0, Math.min(offset, sample.duration - 0.01))
      src.stop(t0 + duration + release + 0.05)
    } else {
      const source = ctx.createGain()
      const oscA = ctx.createOscillator()
      const oscB = ctx.createOscillator()
      oscA.type = 'sawtooth'
      oscB.type = 'sawtooth'
      oscB.detune.value = 7
      for (const osc of [oscA, oscB]) {
        osc.frequency.value = freq
        if (humanize && prev && gapBefore < 0.03) {
          const prevFreq = midiToFreq(prev.midi)
          osc.frequency.setValueAtTime(prevFreq, t0)
          osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.08)
        }
        osc.connect(source)
        detuneTargets.push(osc.detune)
      }

      const breathNoise = ctx.createBufferSource()
      breathNoise.buffer = noise
      breathNoise.loop = true
      const breathGain = ctx.createGain()
      breathGain.gain.value = 0.12 + breathiness * 0.4
      breathNoise.connect(breathGain).connect(source)

      const formants = FORMANTS[vowel]
      formants.forEach((f, idx) => {
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = f * shift
        bp.Q.value = FORMANT_Q[idx]
        const g = ctx.createGain()
        g.gain.value = FORMANT_GAIN[idx] * 2.6
        source.connect(bp).connect(g).connect(env)
      })
      const dry = ctx.createGain()
      dry.gain.value = 0.06
      source.connect(dry).connect(env)

      const stopAt = t0 + duration + release + 0.05
      for (const node of [oscA, oscB, breathNoise]) {
        node.start(t0 - 0.005)
        node.stop(stopAt)
      }
    }

    if (startsWithConsonant(note.lyric, language)) {
      noiseBurst(ctx, noise, voiceBus, t0 - 0.01, { duration: 0.045, level: 0.12, frequency: 4200, q: 1.2 })
    }

    if (humanize) {
      for (const param of detuneTargets) {
        param.setValueAtTime(-35 * humanize.pitchDrift, t0)
        param.setTargetAtTime((Math.random() - 0.5) * 6 * humanize.pitchDrift, t0, 0.05)
      }
      if (duration > 0.4 && humanize.vibrato > 0) {
        const lfo = ctx.createOscillator()
        lfo.frequency.value = (profile?.vibratoRate ?? 5.5) + (Math.random() - 0.5) * 0.6
        const depth = ctx.createGain()
        const maxDepth = (profile?.vibratoDepth ?? 35) * humanize.vibrato
        depth.gain.setValueAtTime(0, t0)
        depth.gain.setValueAtTime(0, t0 + Math.min(0.3, duration * 0.4))
        depth.gain.linearRampToValueAtTime(maxDepth, t0 + Math.min(0.75, duration * 0.85))
        lfo.connect(depth)
        detuneTargets.forEach((param) => depth.connect(param))
        lfo.start(t0)
        lfo.stop(t0 + duration + release + 0.05)
      }
      if (humanize.breath > 0 && gapBefore > 0.45) {
        const breathStart = Math.max(0.02, t0 - Math.min(0.42, gapBefore * 0.8))
        noiseBurst(ctx, noise, voiceBus, breathStart, {
          duration: Math.max(0.18, t0 - breathStart - 0.03),
          level: 0.06 * humanize.breath,
          frequency: 1700,
          q: 0.7,
        })
      }
    }

    opts.onProgress?.((i + 1) / Math.max(1, notes.length))
  }

  const buffer = await ctx.startRendering()
  normalize(buffer, 0.92)
  return buffer
}

function normalize(buffer: AudioBuffer, target: number) {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
  }
  if (peak < 1e-4) return
  const gain = target / peak
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) data[i] *= gain
  }
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels
  const length = buffer.length * channels * 2
  const view = new DataView(new ArrayBuffer(44 + length))
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length, true)
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c))
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, data[c][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}

export function computePeaks(buffer: AudioBuffer, bins = 160) {
  const data = buffer.getChannelData(0)
  const size = Math.floor(data.length / bins)
  const peaks: number[] = []
  for (let b = 0; b < bins; b++) {
    let max = 0
    for (let i = b * size; i < (b + 1) * size; i += 32) max = Math.max(max, Math.abs(data[i]))
    peaks.push(max)
  }
  return peaks
}

export function toRenderResult(buffer: AudioBuffer, label: string): RenderResult {
  const blob = encodeWav(buffer)
  return {
    blob,
    url: URL.createObjectURL(blob),
    duration: buffer.duration,
    peaks: computePeaks(buffer),
    createdAt: Date.now(),
    label,
  }
}
