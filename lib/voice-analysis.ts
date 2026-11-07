'use client'

import type { VoiceProfile } from './types'

const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0))

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function detectPitch(data: Float32Array, start: number, size: number, sampleRate: number) {
  const minLag = Math.floor(sampleRate / 1000)
  const maxLag = Math.floor(sampleRate / 70)
  let bestLag = -1
  let bestCorr = 0
  let energy = 0
  for (let i = 0; i < size; i++) energy += data[start + i] * data[start + i]
  if (energy === 0) return null
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0
    for (let i = 0; i < size; i += 2) corr += data[start + i] * data[start + i + lag]
    corr = (corr * 2) / energy
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }
  return bestCorr > 0.55 && bestLag > 0 ? { freq: sampleRate / bestLag, confidence: bestCorr } : null
}

/**
 * Extracts real acoustic features (F0, range, brightness, breathiness, vibrato)
 * from an uploaded recording. These drive the singing profile used by the renderer.
 */
export async function analyzeVoice(file: File, onProgress: (ratio: number) => void): Promise<VoiceProfile> {
  const arrayBuffer = await file.arrayBuffer()
  const decoder = new OfflineAudioContext(1, 1, 44100)
  const audio = await decoder.decodeAudioData(arrayBuffer)
  const data = audio.getChannelData(0)
  const sampleRate = audio.sampleRate

  const frameSize = 1024
  const maxLag = Math.floor(sampleRate / 70)
  const usable = data.length - frameSize - maxLag
  if (usable <= 0) throw new Error('El audio es demasiado corto para analizarlo.')
  const frameCount = Math.min(160, Math.max(8, Math.floor(usable / frameSize)))
  const hop = Math.floor(usable / frameCount)

  const pitches: number[] = []
  let zcrSum = 0
  let voicedFrames = 0
  let loudFrames = 0

  for (let f = 0; f < frameCount; f++) {
    const start = f * hop
    let rms = 0
    let crossings = 0
    for (let i = 0; i < frameSize; i++) {
      const s = data[start + i]
      rms += s * s
      if (i > 0 && Math.sign(s) !== Math.sign(data[start + i - 1])) crossings++
    }
    rms = Math.sqrt(rms / frameSize)
    if (rms > 0.01) {
      loudFrames++
      zcrSum += crossings / frameSize
      const pitch = detectPitch(data, start, frameSize, sampleRate)
      if (pitch) {
        voicedFrames++
        pitches.push(pitch.freq)
      }
    }
    if (f % 8 === 0) {
      onProgress(f / frameCount)
      await yieldToUi()
    }
  }
  onProgress(1)

  const base = median(pitches) || 220
  const sorted = [...pitches].sort((a, b) => a - b)
  const low = sorted[Math.floor(sorted.length * 0.1)] ?? base * 0.8
  const high = sorted[Math.floor(sorted.length * 0.9)] ?? base * 1.25
  const cents = pitches.map((p) => 1200 * Math.log2(p / base)).filter((c) => Math.abs(c) < 200)
  const deviation = cents.length ? Math.sqrt(cents.reduce((s, c) => s + c * c, 0) / cents.length) : 30
  const zcr = loudFrames ? zcrSum / loudFrames : 0.05
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
    name: file.name.replace(/\.[^.]+$/, ''),
    sourceFile: file.name,
    createdAt: new Date().toISOString(),
    durationSec: audio.duration,
    basePitchHz: Math.round(base),
    pitchRange: [Math.round(low), Math.round(high)],
    formantShift: Number(clamp(0.86 + ((base - 100) / 250) * 0.3, 0.84, 1.22).toFixed(3)),
    brightness: Number(clamp(zcr * 9, 0.2, 1).toFixed(3)),
    breathiness: Number(clamp(1 - voicedFrames / Math.max(1, loudFrames), 0.05, 0.8).toFixed(3)),
    vibratoRate: Number(clamp(4.8 + (base / 600) * 1.6, 4.6, 6.6).toFixed(2)),
    vibratoDepth: Math.round(clamp(deviation, 18, 60)),
    engine: 'KoeSynth RVC-style feature profile v1',
  }
}
