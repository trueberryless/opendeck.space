import type { Page } from '@playwright/test'

export interface WorkerMessage {
  language?: string
  localOnly: boolean
  model: string
  type: 'load' | 'transcribe'
}

interface SpeechWindow {
  __heard: string
  __workerMessages: WorkerMessage[]
}

export async function fakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const context = new AudioContext()
          const oscillator = context.createOscillator()
          const destination = context.createMediaStreamDestination()
          oscillator.connect(destination)
          oscillator.start()
          return destination.stream
        },
      },
    })
  })
}

export async function fakeSpeechWorker(page: Page, heard = '') {
  await page.addInitScript((initial) => {
    const scope = window as unknown as SpeechWindow
    scope.__heard = initial
    scope.__workerMessages = []
    const RealWorker = window.Worker

    class SpeechWorker extends EventTarget {
      postMessage(message: WorkerMessage & { id: number }) {
        scope.__workerMessages.push(message)
        void this.answer(message)
      }

      terminate() {}

      async answer(message: WorkerMessage & { id: number }) {
        const reply = (data: unknown) => this.dispatchEvent(new MessageEvent('message', { data }))
        if (message.type === 'transcribe') return reply({ type: 'result', id: message.id, text: scope.__heard })
        const repo = `https://huggingface.co/onnx-community/whisper-${message.model}/resolve/main/`
        reply({ type: 'progress', id: message.id, file: 'onnx/encoder_model_quantized.onnx', loaded: 1, total: 2 })
        const cache = await caches.open('transformers-cache')
        const file = (size: number) => new Response('x', { headers: { 'content-length': String(size) } })
        await cache.put(`${repo}onnx/encoder_model_quantized.onnx`, file(23_000_000))
        await cache.put(`${repo}onnx/decoder_model_merged_quantized.onnx`, file(52_000_000))
        await cache.put('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0/dist/ort.wasm', file(27_000_000))
        reply({ type: 'loaded', id: message.id })
      }
    }

    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: function Worker(url: string | URL, options?: WorkerOptions) {
        return String(url).includes('speech.worker') ? new SpeechWorker() : new RealWorker(url, options)
      },
    })
  }, heard)
}

export function setHeard(page: Page, text: string) {
  return page.evaluate((value) => ((window as unknown as SpeechWindow).__heard = value), text)
}

export function workerMessages(page: Page): Promise<WorkerMessage[]> {
  return page.evaluate(() =>
    (window as unknown as SpeechWindow).__workerMessages.map(({ language, localOnly, model, type }) => ({
      language,
      localOnly,
      model,
      type,
    })),
  )
}
