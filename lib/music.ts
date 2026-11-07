export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si']

export const MIDI_LOW = 21
export const MIDI_HIGH = 108

export interface PianoKey {
  midi: number
  name: string
  solfege: string
  octave: number
  isBlack: boolean
}

function buildKey(midi: number): PianoKey {
  const pitchClass = midi % 12
  const octave = Math.floor(midi / 12) - 1
  const base = NOTE_NAMES[pitchClass]
  return {
    midi,
    name: `${base}${octave}`,
    solfege: `${SOLFEGE[pitchClass]}${octave}`,
    octave,
    isBlack: base.includes('#'),
  }
}

/** 88 keys from A0 (MIDI 21) to C8 (MIDI 108): 52 white + 36 black. */
export const PIANO_KEYS: PianoKey[] = Array.from({ length: MIDI_HIGH - MIDI_LOW + 1 }, (_, i) =>
  buildKey(MIDI_LOW + i),
)

/** Top-to-bottom order used by the piano roll (C8 first). */
export const KEYS_DESC: PianoKey[] = [...PIANO_KEYS].reverse()

export function midiToName(midi: number) {
  return buildKey(midi).name
}

export function midiToSolfege(midi: number) {
  return buildKey(midi).solfege
}

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function freqToMidi(freq: number) {
  return 69 + 12 * Math.log2(freq / 440)
}
