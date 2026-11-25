import type { Ref } from 'vue'
import { persistStorage } from '~/composables/useOfflineDecks'
import {
  cachedBytes,
  MODEL_CACHE,
  modelPrefix,
  modelStatus,
  pickModel,
  progressFraction,
  RUNTIME_PREFIX,
  speechModel,
  SPEECH_MODELS,
  trackProgress,
  whisperLanguage,
  type CachedEntry,
  type FileProgress,
  type ModelState,
  type SpeechModelId,
} from '~/utils/speechModels'
import type { LoadRequest, TranscribeRequest, WorkerResponse } from '~/utils/speechWorker'

interface Pending {
  onProgress?: (file: string, loaded: number, total: number) => void
  reject: (error: Error) => void
  resolve: (text: string) => void
}

type Outgoing = Omit<LoadRequest, 'id'> | Omit<TranscribeRequest, 'id'>

interface DeviceStorage {
  completed: Ref<SpeechModelId[]>
  preferred: Ref<SpeechModelId | ''>
}

let worker: Worker | null = null
let nextId = 0
let device: DeviceStorage | undefined
const pending = new Map<number, Pending>()

function deviceStorage(): DeviceStorage {
  device ??= effectScope(true).run(() => ({
    completed: useLocalStorage<SpeechModelId[]>('opendeck-speech-models', []),
    preferred: useLocalStorage<SpeechModelId | ''>('opendeck-speech-model', ''),
  }))
  if (!device) throw new Error('Could not open the speech model storage')
  return device
}

function getWorker(): Worker {
  if (worker) return worker
  const created = new Worker(new URL('../workers/speech.worker.ts', import.meta.url), { type: 'module' })
  created.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    const request = pending.get(message.id)
    if (!request) return
    if (message.type === 'progress') return request.onProgress?.(message.file, message.loaded, message.total)
    pending.delete(message.id)
    if (message.type === 'error') request.reject(new Error(message.message))
    else request.resolve(message.type === 'result' ? message.text : '')
  })
  created.addEventListener('error', (event) => {
    event.preventDefault()
    resetWorker(new Error(event.message || 'Speech worker failed'))
  })
  worker = created
  return created
}

export function _resetSpeechModels() {
  resetWorker()
  device = undefined
}

function resetWorker(reason = new Error('Cancelled')) {
  worker?.terminate()
  worker = null
  for (const request of pending.values()) request.reject(reason)
  pending.clear()
}

function send(message: Outgoing, onProgress?: Pending['onProgress'], transfer: Transferable[] = []): Promise<string> {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { onProgress, reject, resolve })
    getWorker().postMessage({ ...message, id }, transfer)
  })
}

async function readCache(): Promise<CachedEntry[]> {
  if (typeof caches === 'undefined') return []
  const cache = await caches.open(MODEL_CACHE)
  const requests = await cache.keys()
  return Promise.all(
    requests.map(async (request) => {
      const response = await cache.match(request)
      return { url: request.url, size: Number(response?.headers.get('content-length')) || 0 }
    }),
  )
}

async function deleteCached(prefix: string) {
  if (typeof caches === 'undefined') return
  const cache = await caches.open(MODEL_CACHE)
  for (const request of await cache.keys()) if (request.url.startsWith(prefix)) await cache.delete(request)
}

export function useSpeechModels() {
  const { completed, preferred } = deviceStorage()
  const states = useState<Record<string, ModelState>>('opendeck-speech-model-states', () => ({}))
  const sizes = useState<Record<string, number>>('opendeck-speech-model-sizes', () => ({}))
  const runtimeCached = useState('opendeck-speech-runtime-cached', () => false)
  const checked = useState('opendeck-speech-models-checked', () => false)
  const usage = useState<number | null>('opendeck-speech-storage', () => null)

  const ready = computed(() => SPEECH_MODELS.filter((m) => stateOf(m.id).status === 'ready').map((m) => m.id))
  const active = computed(() => pickModel(ready.value, preferred.value || undefined))
  const downloading = computed(() => SPEECH_MODELS.find((m) => stateOf(m.id).status === 'downloading')?.id)

  function stateOf(id: SpeechModelId): ModelState {
    return states.value[id] ?? { status: 'missing', progress: 0 }
  }

  function setState(id: SpeechModelId, next: ModelState) {
    states.value = { ...states.value, [id]: next }
  }

  async function refresh() {
    try {
      const entries = await readCache()
      const next = { ...states.value }
      for (const model of SPEECH_MODELS) {
        if (next[model.id]?.status === 'downloading') continue
        const status = modelStatus(model, entries, completed.value)
        const failed = next[model.id]?.status === 'error' && status === 'missing'
        next[model.id] = failed ? (next[model.id] ?? { status, progress: 0 }) : { status, progress: 0 }
      }
      states.value = next
      sizes.value = Object.fromEntries(SPEECH_MODELS.map((m) => [m.id, cachedBytes(entries, modelPrefix(m))]))
      runtimeCached.value = entries.some((e) => e.url.startsWith(RUNTIME_PREFIX))
      usage.value = (await navigator.storage?.estimate?.())?.usage ?? null
    } catch (err) {
      console.error('[opendeck] failed to read speech models', err)
    } finally {
      checked.value = true
    }
  }

  async function download(id: SpeechModelId) {
    const model = speechModel(id)
    if (!model || stateOf(id).status === 'downloading') return
    let files: Record<string, FileProgress> = {}
    setState(id, { status: 'downloading', progress: 0 })
    void persistStorage()
    try {
      await send({ type: 'load', model: id, localOnly: false }, (file, loaded, total) => {
        files = trackProgress(files, file, loaded, total)
        if (stateOf(id).status === 'downloading')
          setState(id, { status: 'downloading', progress: progressFraction(files, model.megabytes * 1_000_000) })
      })
      completed.value = [...new Set([...completed.value, id])]
      setState(id, { status: 'ready', progress: 1 })
    } catch (err) {
      if (stateOf(id).status !== 'downloading') return
      setState(id, { status: 'error', progress: 0, error: err instanceof Error ? err.message : String(err) })
    }
    await refresh()
  }

  async function cancel(id: SpeechModelId) {
    const model = speechModel(id)
    if (!model) return
    setState(id, { status: 'missing', progress: 0 })
    resetWorker()
    await deleteCached(modelPrefix(model))
    await refresh()
  }

  async function remove(id: SpeechModelId) {
    const model = speechModel(id)
    if (!model) return
    completed.value = completed.value.filter((m) => m !== id)
    if (preferred.value === id) preferred.value = ''
    resetWorker()
    await deleteCached(modelPrefix(model))
    if (!completed.value.length) await deleteCached(RUNTIME_PREFIX)
    await refresh()
  }

  function canCheck(lang: string | undefined): boolean {
    return Boolean(whisperLanguage(lang))
  }

  async function transcribe(audio: Float32Array, lang: string | undefined): Promise<string> {
    const model = active.value
    if (!model) throw new Error('No speech model on this device')
    return send({ type: 'transcribe', model, audio, language: whisperLanguage(lang), localOnly: true }, undefined, [
      audio.buffer,
    ])
  }

  return {
    active,
    cancel,
    canCheck,
    checked,
    download,
    downloading,
    preferred,
    ready,
    refresh,
    remove,
    runtimeCached,
    sizes,
    stateOf,
    transcribe,
    usage,
  }
}
