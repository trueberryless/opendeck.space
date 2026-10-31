const LATIN_RUN_RE = /[a-zāēīōūâêîôû']+/gu
const MACRON_RE = /[āēīōūâêîôû]/gu
const VOWELS = new Set(['a', 'i', 'u', 'e', 'o'])
const MACRONS: Record<string, string> = {
  ā: 'aa',
  â: 'aa',
  ē: 'ee',
  ê: 'ee',
  ī: 'ii',
  î: 'ii',
  ō: 'ou',
  ô: 'ou',
  ū: 'uu',
  û: 'uu',
}

const SYLLABLES: Record<string, string> = {
  a: 'あ',
  i: 'い',
  u: 'う',
  e: 'え',
  o: 'お',
  ka: 'か',
  ki: 'き',
  ku: 'く',
  ke: 'け',
  ko: 'こ',
  sa: 'さ',
  si: 'し',
  shi: 'し',
  su: 'す',
  se: 'せ',
  so: 'そ',
  ta: 'た',
  ti: 'ち',
  chi: 'ち',
  tu: 'つ',
  tsu: 'つ',
  te: 'て',
  to: 'と',
  na: 'な',
  ni: 'に',
  nu: 'ぬ',
  ne: 'ね',
  no: 'の',
  ha: 'は',
  hi: 'ひ',
  hu: 'ふ',
  fu: 'ふ',
  he: 'へ',
  ho: 'ほ',
  ma: 'ま',
  mi: 'み',
  mu: 'む',
  me: 'め',
  mo: 'も',
  ya: 'や',
  yu: 'ゆ',
  yo: 'よ',
  ra: 'ら',
  ri: 'り',
  ru: 'る',
  re: 'れ',
  ro: 'ろ',
  wa: 'わ',
  wo: 'を',
  ga: 'が',
  gi: 'ぎ',
  gu: 'ぐ',
  ge: 'げ',
  go: 'ご',
  za: 'ざ',
  zi: 'じ',
  ji: 'じ',
  zu: 'ず',
  ze: 'ぜ',
  zo: 'ぞ',
  da: 'だ',
  di: 'ぢ',
  du: 'づ',
  dzu: 'づ',
  de: 'で',
  do: 'ど',
  ba: 'ば',
  bi: 'び',
  bu: 'ぶ',
  be: 'べ',
  bo: 'ぼ',
  pa: 'ぱ',
  pi: 'ぴ',
  pu: 'ぷ',
  pe: 'ぺ',
  po: 'ぽ',
  fa: 'ふぁ',
  fi: 'ふぃ',
  fe: 'ふぇ',
  fo: 'ふぉ',
  ja: 'じゃ',
  ju: 'じゅ',
  je: 'じぇ',
  jo: 'じょ',
  sha: 'しゃ',
  shu: 'しゅ',
  she: 'しぇ',
  sho: 'しょ',
  cha: 'ちゃ',
  chu: 'ちゅ',
  che: 'ちぇ',
  cho: 'ちょ',
}

for (const [consonant, kana] of Object.entries({
  k: 'き',
  g: 'ぎ',
  n: 'に',
  h: 'ひ',
  b: 'び',
  p: 'ぴ',
  m: 'み',
  r: 'り',
  j: 'じ',
  s: 'し',
  z: 'じ',
  t: 'ち',
  c: 'ち',
})) {
  SYLLABLES[`${consonant}ya`] = `${kana}ゃ`
  SYLLABLES[`${consonant}yu`] = `${kana}ゅ`
  SYLLABLES[`${consonant}yo`] = `${kana}ょ`
}

export function romajiToHiragana(text: string): string {
  return text.replace(LATIN_RUN_RE, (run) => convertRun(run.replace(MACRON_RE, (c) => MACRONS[c] ?? c)))
}

function convertRun(run: string): string {
  let out = ''
  let i = 0
  while (i < run.length) {
    const char = run[i] ?? ''
    const next = run[i + 1] ?? ''

    if (char === "'") {
      i++
      continue
    }
    if (char === 'n') {
      if (next === 'n') {
        out += 'ん'
        i += VOWELS.has(run[i + 2] ?? '') || run[i + 2] === 'y' ? 1 : 2
        continue
      }
      if (!VOWELS.has(next) && next !== 'y') {
        out += 'ん'
        i++
        continue
      }
    }
    if (char === 't' && next === 'c') {
      out += 'っ'
      i++
      continue
    }
    if (char === next && !VOWELS.has(char)) {
      out += 'っ'
      i++
      continue
    }

    const match = [3, 2, 1].map((length) => run.slice(i, i + length)).find((part) => SYLLABLES[part])
    if (match) {
      out += SYLLABLES[match]
      i += match.length
      continue
    }
    out += char
    i++
  }
  return out
}
