import { speechModel, type SpeechModel, type SpeechModelId } from '~/utils/speechModels'

export interface LoadRequest {
  id: number
  localOnly: boolean
  model: SpeechModelId
  type: 'load'
}

export interface TranscribeRequest {
  audio: Float32Array
  id: number
  language?: string
  localOnly: boolean
  model: SpeechModelId
  type: 'transcribe'
}

export type WorkerRequest = LoadRequest | TranscribeRequest

export type WorkerResponse =
  | { file: string; id: number; loaded: number; total: number; type: 'progress' }
  | { id: number; type: 'loaded' }
  | { id: number; text: string; type: 'result' }
  | { id: number; message: string; type: 'error' }

export interface LoadProgress {
  file?: string
  loaded?: number
  status: string
  total?: number
}

export type Transcribe = (audio: Float32Array, language: string | undefined) => Promise<string>

export type LoadTranscriber = (
  model: SpeechModel,
  localOnly: boolean,
  onProgress: (progress: LoadProgress) => void,
) => Promise<Transcribe>

export function createSpeechWorker(load: LoadTranscriber, post: (message: WorkerResponse) => void) {
  const loaded = new Map<SpeechModelId, Promise<Transcribe>>()

  function transcriber(request: WorkerRequest): Promise<Transcribe> {
    const model = speechModel(request.model)
    if (!model) return Promise.reject(new Error(`Unknown speech model: ${request.model}`))
    const existing = loaded.get(model.id)
    if (existing) return existing
    const next = load(model, request.localOnly, (progress) => {
      if (progress.status !== 'progress' || !progress.file) return
      post({
        type: 'progress',
        id: request.id,
        file: progress.file,
        loaded: progress.loaded ?? 0,
        total: progress.total ?? 0,
      })
    })
    loaded.set(model.id, next)
    next.catch(() => loaded.delete(model.id))
    return next
  }

  return async function handle(request: WorkerRequest) {
    try {
      const transcribe = await transcriber(request)
      if (request.type === 'load') return post({ type: 'loaded', id: request.id })
      const text = await transcribe(request.audio, request.language)
      post({ type: 'result', id: request.id, text: text.trim() })
    } catch (error) {
      post({ type: 'error', id: request.id, message: error instanceof Error ? error.message : String(error) })
    }
  }
}
