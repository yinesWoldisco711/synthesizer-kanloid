import type { Language, Vowel } from './types'

export const LANGUAGES: { value: Language; label: string; placeholder: string; defaultLyric: string; hint: string }[] = [
  { value: 'es', label: 'Español', placeholder: 'ej. can, ta, mor', defaultLyric: 'la', hint: 'Escribe sílabas en español.' },
  { value: 'en', label: 'English', placeholder: 'e.g. love, sky, oh', defaultLyric: 'la', hint: 'Type English syllables or words.' },
  { value: 'ja', label: '日本語', placeholder: '例: さ, く, ら', defaultLyric: 'ら', hint: 'ひらがな・カタカナ・ローマ字に対応。' },
  { value: 'zh', label: '中文 (Pinyin)', placeholder: '例: ni, hao, 爱', defaultLyric: 'la', hint: '支持拼音和常用汉字。' },
]

const KANA_VOWELS: Record<Vowel, string> = {
  a: 'あかさたなはまやらわがざだばぱぁゃアカサタナハマヤラワガザダバパァャ',
  i: 'いきしちにひみりぎじぢびぴぃイキシチニヒミリギジヂビピィ',
  u: 'うくすつぬふむゆるぐずづぶぷぅゅウクスツヌフムユルグズヅブプゥュヴ',
  e: 'えけせてねへめれげぜでべぺぇエケセテネヘメレゲゼデベペェ',
  o: 'おこそとのほもよろをごぞどぼぽぉょオコソトノホモヨロヲゴゾドボポォョ',
}

const HANZI_PINYIN: Record<string, string> = {
  我: 'wo', 你: 'ni', 他: 'ta', 她: 'ta', 爱: 'ai', 的: 'de', 是: 'shi', 啦: 'la', 一: 'yi', 天: 'tian',
  心: 'xin', 月: 'yue', 风: 'feng', 梦: 'meng', 光: 'guang', 星: 'xing', 歌: 'ge', 唱: 'chang', 好: 'hao',
  在: 'zai', 想: 'xiang', 美: 'mei', 花: 'hua', 海: 'hai', 雨: 'yu', 夜: 'ye', 春: 'chun', 飞: 'fei',
  空: 'kong', 远: 'yuan', 来: 'lai', 去: 'qu', 人: 'ren', 声: 'sheng', 音: 'yin', 们: 'men', 说: 'shuo',
}

const VOWELS: Vowel[] = ['a', 'e', 'i', 'o', 'u']

function stripAccents(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function latinVowel(text: string, language: Language): Vowel | null {
  const clean = stripAccents(text).replace(/[^a-z]/g, '')
  if (!clean) return null
  if (language === 'zh') {
    if (clean.includes('a')) return 'a'
    if (clean.includes('o')) return 'o'
    if (clean.includes('e')) return 'e'
    if (clean.includes('i') || clean.includes('v')) return 'i'
    if (clean.includes('u')) return 'u'
    return null
  }
  if (language === 'en') {
    if (/^(the|a)$/.test(clean)) return 'a'
    if (/ee|ea|ie|y$/.test(clean)) return 'i'
    if (/oo|ou|ew/.test(clean)) return 'u'
    if (/oa|ow|o$/.test(clean)) return 'o'
  }
  for (const char of clean) {
    if ((VOWELS as string[]).includes(char)) return char as Vowel
  }
  if (clean.includes('y')) return 'i'
  return null
}

function kanaVowel(text: string): Vowel | null {
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i]
    if (char === 'ん' || char === 'ン') {
      if (text.length === 1) return 'u'
      continue
    }
    for (const vowel of VOWELS) {
      if (KANA_VOWELS[vowel].includes(char)) return vowel
    }
  }
  return null
}

export function toPinyin(text: string) {
  return [...text].map((char) => HANZI_PINYIN[char] ?? char).join('')
}

/** Extracts the sung vowel nucleus from a lyric to drive the formant filter. */
export function getVowel(lyric: string, language: Language): Vowel {
  const text = lyric.trim()
  if (!text) return 'a'
  if (language === 'ja') return kanaVowel(text) ?? latinVowel(text, language) ?? 'a'
  if (language === 'zh') return latinVowel(toPinyin(text), language) ?? 'a'
  return latinVowel(text, language) ?? 'a'
}

export function startsWithConsonant(lyric: string, language: Language) {
  const text = language === 'zh' ? toPinyin(lyric.trim()) : lyric.trim()
  if (!text) return false
  if (language === 'ja' && /[\u3040-\u30ff]/.test(text[0])) {
    return !'あいうえおアイウエオ'.includes(text[0])
  }
  const first = stripAccents(text)[0]
  return !!first && /[a-z]/.test(first) && !(VOWELS as string[]).includes(first)
}

export function phoneticHint(lyric: string, language: Language) {
  const vowel = getVowel(lyric, language)
  const text = language === 'zh' ? toPinyin(lyric.trim()) : lyric.trim()
  return `${text || '—'}  →  /${vowel}/`
}
