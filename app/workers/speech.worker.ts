import { createSpeechWorker, type WorkerRequest, type WorkerResponse } from '../utils/speechWorker'

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void
  postMessage(message: WorkerResponse, transfer: Transferable[]): void
}

interface Recognizer {
  (
    audio: Float32Array,
    options: { language?: string; task: 'transcribe' },
  ): Promise<{ text: string } | { text: string }[]>
}

const scope = self as unknown as WorkerScope

const handle = createSpeechWorker(
  async (model, localOnly, onProgress) => {
    const { env, pipeline } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    const recognize = (await pipeline('automatic-speech-recognition', model.repo, {
      device: 'wasm',
      dtype: 'q8',
      local_files_only: localOnly,
      progress_callback: onProgress,
    })) as unknown as Recognizer
    return async (audio, language) => {
      const output = await recognize(audio, { language, task: 'transcribe' })
      return (Array.isArray(output) ? output : [output]).map((o) => o.text).join(' ')
    }
  },
  (message) => scope.postMessage(message, []),
)

scope.addEventListener('message', (event) => void handle(event.data))
