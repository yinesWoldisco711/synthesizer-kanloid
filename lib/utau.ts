'use client'

import type { Character, OtoEntry, UtauBank } from './types'

function decodeText(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // Most classic UTAU banks are encoded in Shift-JIS.
    return new TextDecoder('shift_jis').decode(bytes)
  }
}

function parseOto(text: string, dir: string): OtoEntry[] {
  const entries: OtoEntry[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    const eq = line.indexOf('=')
    if (!line || eq < 0) continue
    const wav = line.slice(0, eq)
    const [alias, offset, consonant, cutoff, preutter, overlap] = line.slice(eq + 1).split(',')
    entries.push({
      alias: (alias || wav.replace(/\.wav$/i, '')).trim(),
      file: `${dir}${wav}`,
      offset: Number(offset) || 0,
      consonant: Number(consonant) || 0,
      cutoff: Number(cutoff) || 0,
      preutter: Number(preutter) || 0,
      overlap: Number(overlap) || 0,
    })
  }
  return entries
}

export async function importUtauZip(file: File, onProgress?: (ratio: number) => void): Promise<UtauBank> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file, {
    decodeFileName: (bytes) => decodeText(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as unknown as ArrayLike<number>)),
  })
  const allFiles = Object.values(zip.files).filter((f) => !f.dir)
  const otoFiles = allFiles.filter((f) => /(^|\/)oto\.ini$/i.test(f.name))
  if (otoFiles.length === 0) throw new Error('El .zip no contiene ningún archivo oto.ini.')

  const entries: OtoEntry[] = []
  for (let i = 0; i < otoFiles.length; i++) {
    const oto = otoFiles[i]
    const bytes = await oto.async('uint8array')
    const dir = oto.name.slice(0, oto.name.lastIndexOf('/') + 1)
    entries.push(...parseOto(decodeText(bytes), dir))
    onProgress?.((i + 1) / otoFiles.length)
  }

  let name = file.name.replace(/\.zip$/i, '')
  const characterTxt = allFiles.find((f) => /(^|\/)character\.txt$/i.test(f.name))
  if (characterTxt) {
    const text = decodeText(await characterTxt.async('uint8array'))
    const match = text.match(/^name=(.+)$/m)
    if (match) name = match[1].trim()
  }

  const aliasMap = new Map<string, OtoEntry>()
  for (const entry of entries) {
    const key = entry.alias.toLowerCase()
    if (!aliasMap.has(key)) aliasMap.set(key, entry)
  }

  return {
    name,
    sourceFile: file.name,
    entries,
    aliasMap,
    wavCount: allFiles.filter((f) => /\.wav$/i.test(f.name)).length,
    baseMidi: 60,
    zip,
    bufferCache: new Map(),
  }
}

export function findOtoEntry(bank: UtauBank, lyric: string): OtoEntry | null {
  const key = lyric.trim().toLowerCase()
  if (!key) return null
  const direct = bank.aliasMap.get(key) ?? bank.aliasMap.get(`- ${key}`) ?? bank.aliasMap.get(`-${key}`)
  if (direct) return direct
  for (const [alias, entry] of bank.aliasMap) {
    if (alias.endsWith(` ${key}`)) return entry
  }
  return null
}

export async function getSampleBuffer(bank: UtauBank, entry: OtoEntry): Promise<AudioBuffer | null> {
  const cached = bank.bufferCache.get(entry.file)
  if (cached) return cached
  const zipFile =
    bank.zip.file(entry.file) ??
    Object.values(bank.zip.files).find((f) => f.name.toLowerCase() === entry.file.toLowerCase()) ??
    null
  if (!zipFile) return null
  try {
    const data = await zipFile.async('arraybuffer')
    const decoder = new OfflineAudioContext(1, 1, 44100)
    const buffer = await decoder.decodeAudioData(data)
    bank.bufferCache.set(entry.file, buffer)
    return buffer
  } catch {
    return null
  }
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return response.blob()
}

/** Exports the active voicebank (or a fresh one) as a UTAU-compatible .zip. */
export async function exportVoicebankZip(character: Character, bank: UtauBank | null) {
  const { default: JSZip } = await import('jszip')
  const out = new JSZip()
  const folder = out.folder(character.name || 'voicebank')!

  if (bank) {
    for (const file of Object.values(bank.zip.files)) {
      if (file.dir || /(^|\/)character\.txt$/i.test(file.name)) continue
      const relative = file.name.includes('/') ? file.name.slice(file.name.indexOf('/') + 1) : file.name
      folder.file(relative || file.name, await file.async('uint8array'))
    }
  } else {
    folder.file('oto.ini', '')
  }

  let imageLine = ''
  if (character.avatarUrl) {
    const blob = await dataUrlToBlob(character.avatarUrl)
    folder.file('icon.png', blob)
    imageLine = 'image=icon.png\n'
  }
  folder.file(
    'character.txt',
    `name=${character.name}\n${imageLine}author=${character.provider}\n`,
  )
  folder.file(
    'readme.txt',
    `${character.name}\nProveedor de voz: ${character.provider}\nEdad: ${character.age}\nGénero: ${character.gender}\n\n${character.description}\n`,
  )
  if (character.profile) {
    folder.file('koesynth-profile.json', JSON.stringify(character.profile, null, 2))
  }
  return out.generateAsync({ type: 'blob' })
}
