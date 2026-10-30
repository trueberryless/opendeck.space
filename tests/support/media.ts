import { vi } from 'vitest'
import type { WorkerRequest, WorkerResponse } from '~/utils/speechWorker'
import { stubNavigator } from './navigator'

class FakeTrack {
  stopped = false
  stop = () => {
    this.stopped = true
  }
}

class FakeStream {
  readonly tracks = [new FakeTrack()]
  getTracks = () => this.tracks
}

class FakeMediaRecorder extends EventTarget {
  static instances: FakeMediaRecorder[] = []
  static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus'
  state: 'inactive' | 'recording' = 'inactive'
  readonly mimeType: string

  constructor(
    readonly stream: FakeStream,
    options?: { mimeType?: string },
  ) {
    super()
    this.mimeType = options?.mimeType ?? ''
    FakeMediaRecorder.instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.dispatchEvent(
      Object.assign(new Event('dataavailable'), { data: new Blob(['voice'], { type: this.mimeType }) }),
    )
    this.dispatchEvent(new Event('stop'))
  }
}

export function stubMicrophone(options: { deny?: string } = {}) {
  FakeMediaRecorder.instances = []
  const streams: FakeStream[] = []
  const getUserMedia = vi.fn(async () => {
    if (options.deny) throw new DOMException('no', options.deny)
    const stream = new FakeStream()
    streams.push(stream)
    return stream
  })
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  stubNavigator({ mediaDevices: { getUserMedia } })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return { getUserMedia, streams }
}

export class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = []
  readonly received: WorkerRequest[] = []
  terminated = false

  constructor(readonly url: URL | string) {
    super()
    FakeWorker.instances.push(this)
  }

  postMessage = vi.fn((message: WorkerRequest) => {
    this.received.push(message)
  })

  terminate = vi.fn(() => {
    this.terminated = true
  })

  reply(message: WorkerResponse) {
    this.dispatchEvent(new MessageEvent('message', { data: message }))
  }

  last(): WorkerRequest {
    const message = this.received.at(-1)
    if (!message) throw new Error('The worker received no message')
    return message
  }
}

export function stubWorker() {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
  return () => {
    const worker = FakeWorker.instances.at(-1)
    if (!worker) throw new Error('No speech worker was started')
    return worker
  }
}

class FakeCache {
  readonly entries = new Map<string, Response>()

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url))
  }

  async match(request: Request | string) {
    return this.entries.get(typeof request === 'string' ? request : request.url)
  }

  async put(url: string, response: Response) {
    this.entries.set(url, response)
  }

  async delete(request: Request | string) {
    return this.entries.delete(typeof request === 'string' ? request : request.url)
  }

  file(url: string, size: number) {
    this.entries.set(url, new Response('x', { headers: { 'content-length': String(size) } }))
  }
}

export function stubCaches() {
  const cache = new FakeCache()
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) })
  return cache
}

export class FakeAudio extends EventTarget {
  static played: string[] = []
  paused = true

  constructor(readonly src: string) {
    super()
  }

  play = vi.fn(async () => {
    FakeAudio.played.push(this.src)
    this.paused = false
  })

  pause = vi.fn(() => {
    if (this.paused) return
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  })

  end() {
    this.paused = true
    this.dispatchEvent(new Event('ended'))
  }
}

export function stubPlayback() {
  FakeAudio.played = []
  const elements: FakeAudio[] = []
  vi.stubGlobal(
    'Audio',
    class extends FakeAudio {
      constructor(src: string) {
        super(src)
        elements.push(this)
      }
    },
  )
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor(readonly options: { sampleRate: number }) {}
      decodeAudioData = vi.fn(async () => ({
        numberOfChannels: 1,
        getChannelData: () => new Float32Array([0.1, 0.2, 0.3]),
      }))
      close = vi.fn(async () => {})
    },
  )
  return elements
}
