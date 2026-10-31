import { speechLanguage } from '~/utils/speech'

export const MODEL_CACHE = 'transformers-cache'
export const MODEL_HOST = 'https://huggingface.co/'
export const RUNTIME_PREFIX = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@'
export const RUNTIME_MEGABYTES = 27

export const SPEECH_MODELS = [
  { id: 'base', megabytes: 75, repo: 'onnx-community/whisper-base' },
  { id: 'small', megabytes: 250, repo: 'onnx-community/whisper-small' },
] as const

export type SpeechModel = (typeof SPEECH_MODELS)[number]
export type SpeechModelId = SpeechModel['id']
export type ModelStatus = 'missing' | 'downloading' | 'ready' | 'error'

export interface ModelState {
  error?: string
  progress: number
  status: ModelStatus
}

export interface FileProgress {
  loaded: number
  total: number
}

export interface CachedEntry {
  size: number
  url: string
}

const WHISPER_LANGUAGES = new Set(
  'af am ar as az ba be bg bn bo br bs ca cs cy da de el en es et eu fa fi fo fr gl gu ha haw he hi hr ht hu hy id is it ja jw ka kk km kn ko la lb ln lo lt lv mg mi mk ml mn mr ms mt my ne nl nn no oc pa pl ps pt ro ru sa sd si sk sl sn so sq sr su sv sw ta te tg th tk tl tr tt uk ur uz vi yi yo zh'.split(
    ' ',
  ),
)
const WHISPER_ALIASES: Record<string, string> = { jv: 'jw', nb: 'no' }

export function speechModel(id: string | undefined): SpeechModel | undefined {
  return SPEECH_MODELS.find((m) => m.id === id)
}

export function whisperLanguage(lang: string | undefined): string | undefined {
  const language = speechLanguage(lang)
  if (!language) return undefined
  const code = WHISPER_ALIASES[language] ?? language
  return WHISPER_LANGUAGES.has(code) ? code : undefined
}

export function modelPrefix(model: SpeechModel): string {
  return `${MODEL_HOST}${model.repo}/`
}

export function trackProgress(
  files: Readonly<Record<string, FileProgress>>,
  file: string,
  loaded: number,
  total: number,
): Record<string, FileProgress> {
  return { ...files, [file]: { loaded: Math.min(loaded, total || loaded), total } }
}

export function progressFraction(files: Readonly<Record<string, FileProgress>>, expectedBytes: number): number {
  const list = Object.values(files)
  const loaded = list.reduce((sum, f) => sum + f.loaded, 0)
  const total = Math.max(
    expectedBytes,
    list.reduce((sum, f) => sum + f.total, 0),
  )
  return total > 0 ? Math.min(1, loaded / total) : 0
}

export function cachedBytes(entries: readonly CachedEntry[], prefix: string): number {
  return entries.filter((e) => e.url.startsWith(prefix)).reduce((sum, e) => sum + e.size, 0)
}

export function modelStatus(
  model: SpeechModel,
  entries: readonly CachedEntry[],
  completed: readonly string[],
): ModelStatus {
  const present = entries.some((e) => e.url.startsWith(modelPrefix(model)))
  return present && completed.includes(model.id) ? 'ready' : 'missing'
}

export function downloadMegabytes(model: SpeechModel, runtimeCached: boolean): number {
  return model.megabytes + (runtimeCached ? 0 : RUNTIME_MEGABYTES)
}

export function pickModel(ready: readonly SpeechModelId[], preferred: string | undefined): SpeechModelId | undefined {
  const choice = ready.find((id) => id === preferred)
  if (choice) return choice
  return SPEECH_MODELS.map((m) => m.id).findLast((id) => ready.includes(id))
}

export function formatMegabytes(megabytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 0 }).format(megabytes)
}

export function scoreLevel(score: number): 'great' | 'close' | 'again' {
  if (score >= 85) return 'great'
  if (score >= 60) return 'close'
  return 'again'
}
