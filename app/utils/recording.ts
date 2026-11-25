export const WHISPER_SAMPLE_RATE = 16_000
export const MAX_RECORDING_MS = 30_000

const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']

export type MicFailure = 'denied' | 'unavailable' | 'unsupported'

export function recordingType(isSupported: (type: string) => boolean): string | undefined {
  return RECORDING_TYPES.find((type) => {
    try {
      return isSupported(type)
    } catch {
      return false
    }
  })
}

export function mixToMono(channels: readonly Float32Array[]): Float32Array {
  const [first] = channels
  if (!first) return new Float32Array()
  if (channels.length === 1) return first
  const mono = new Float32Array(first.length)
  for (const channel of channels) {
    for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] ?? 0) + (channel[i] ?? 0) / channels.length
  }
  return mono
}

export function micFailure(error: unknown): MicFailure {
  const name = error instanceof Error || error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') return 'unavailable'
  return 'unsupported'
}
