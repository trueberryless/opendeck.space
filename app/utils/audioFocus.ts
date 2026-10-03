import { detectSpeechPlatform } from '~/utils/speech'

const SAMPLE_RATE = 8000
const NOISE_AMPLITUDE = 2
const PLAY_TIMEOUT_MS = 600

export interface AudioFocus {
  acquire: () => Promise<void>
  prepare: () => void
  release: () => void
}

export function createAudioFocus(options: AudioFocusOptions = {}): AudioFocus {
  const { tailMs = 1500, warmupMs = 300 } = options
  let element: HTMLAudioElement | undefined
  let held = false
  let playing = false
  let playRequest: Promise<boolean> | undefined
  let warmUntil = 0
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  let previousSessionType: string | undefined

  function prepare() {
    getElement()
  }

  async function acquire() {
    held = true
    clearTimeout(releaseTimer)
    releaseTimer = undefined
    if (playing) return wait(warmUntil - Date.now())

    const started = await Promise.race([startPlaying(), wait(PLAY_TIMEOUT_MS).then(() => false)])
    if (started) return wait(warmUntil - Date.now())
  }

  function release() {
    held = false
    if (!playing || releaseTimer) return
    releaseTimer = setTimeout(stop, tailMs)
  }

  function startPlaying(): Promise<boolean> {
    if (playRequest) return playRequest
    const audio = getElement()
    if (!audio) return Promise.resolve(false)

    setSessionType('transient')
    audio.currentTime = 0
    playRequest = audio
      .play()
      .then(
        () => {
          playing = true
          warmUntil = Date.now() + warmupMs
          if (!held) release()
          return true
        },
        () => {
          restoreSessionType()
          return false
        },
      )
      .finally(() => (playRequest = undefined))
    return playRequest
  }

  function stop() {
    releaseTimer = undefined
    if (!element || !playing) return
    element.pause()
    playing = false
    restoreSessionType()
  }

  function getElement(): HTMLAudioElement | undefined {
    if (element) return element
    if (typeof Audio === 'undefined' || !canHoldFocus()) return undefined
    try {
      element = new Audio(URL.createObjectURL(new Blob([createNoiseWav()], { type: 'audio/wav' })))
    } catch {
      return undefined
    }
    element.loop = true
    element.preload = 'auto'
    return element
  }

  function setSessionType(type: string) {
    const session = audioSession()
    if (!session || previousSessionType !== undefined) return
    previousSessionType = session.type
    session.type = type
  }

  function restoreSessionType() {
    const session = audioSession()
    if (session && previousSessionType !== undefined) session.type = previousSessionType
    previousSessionType = undefined
  }

  return { acquire, prepare, release }
}

export function createNoiseWav(seconds = 1, amplitude = NOISE_AMPLITUDE): Uint8Array<ArrayBuffer> {
  const samples = Math.round(SAMPLE_RATE * seconds)
  const view = new DataView(new ArrayBuffer(44 + samples * 2))

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  writeAscii(view, 8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round((Math.random() * 2 - 1) * amplitude), true)

  return new Uint8Array(view.buffer)
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

function canHoldFocus(): boolean {
  if (audioSession()) return true
  return detectSpeechPlatform(navigator.userAgent, navigator.maxTouchPoints) !== 'ios'
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}

function audioSession(): { type: string } | undefined {
  return (navigator as Navigator & { audioSession?: { type: string } }).audioSession
}

interface AudioFocusOptions {
  tailMs?: number
  warmupMs?: number
}
