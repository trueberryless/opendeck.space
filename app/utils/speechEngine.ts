import type { KeepAlive } from '~/utils/audioKeepAlive'
import { speechTimeout } from '~/utils/speech'

const CANCEL_SETTLE_MS = 120
const START_TIMEOUT_MS = 2500
const POLL_MS = 250
const REPEAT_GUARD_MS = 400
const IGNORED_ERRORS = new Set(['canceled', 'interrupted'])

export type SpeechStatus = 'idle' | 'pending' | 'speaking'
export type SpeechFailure = 'failed' | 'not-allowed'

export interface SpeechRequest {
  auto?: boolean
  key: string
  rate: number
  text: string
  voice: SpeechSynthesisVoice
}

export interface SpeechState {
  key: string
  status: Exclude<SpeechStatus, 'idle'>
}

export interface SpeechEngine {
  speak: (request: SpeechRequest) => void
  stop: () => void
  toggle: (request: SpeechRequest) => void
}

export function createSpeechEngine(options: SpeechEngineOptions): SpeechEngine {
  const { createUtterance, keepAlive, onChange, onError, synth } = options
  let current: Playback | null = null
  const timers = new Set<ReturnType<typeof setTimeout>>()

  function speak(request: SpeechRequest) {
    clearTimers()
    const playback: Playback = { request, requestedAt: Date.now(), status: 'pending' }
    current = playback
    emit()
    void play(playback, true)
  }

  function toggle(request: SpeechRequest) {
    if (current?.request.key !== request.key) return speak(request)
    if (Date.now() - current.requestedAt >= REPEAT_GUARD_MS) stop()
  }

  function stop() {
    if (!current) return
    clearTimers()
    current = null
    synth.cancel()
    emit()
    keepAlive?.release()
  }

  async function play(playback: Playback, mayRetry: boolean) {
    const busy = synth.speaking || synth.pending
    if (busy) synth.cancel()
    await Promise.all([keepAlive?.acquire(), busy || !mayRetry ? wait(CANCEL_SETTLE_MS) : undefined])
    if (current !== playback) return
    if (synth.paused) synth.resume()

    const { rate, text, voice } = playback.request
    const utterance = createUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = rate
    playback.utterance = utterance
    const isActive = () => current === playback && playback.utterance === utterance

    utterance.addEventListener('start', () => {
      if (isActive()) markSpeaking(playback)
    })
    utterance.addEventListener('end', () => {
      if (isActive()) finish(playback)
    })
    utterance.addEventListener('error', (event) => {
      if (!isActive()) return
      const error = (event as SpeechSynthesisErrorEvent).error
      if (IGNORED_ERRORS.has(error)) return finish(playback)
      finish(playback, error === 'not-allowed' ? 'not-allowed' : 'failed')
    })
    synth.speak(utterance)

    after(START_TIMEOUT_MS, () => {
      if (!isActive() || playback.status !== 'pending') return
      if (synth.speaking) return markSpeaking(playback)
      playback.utterance = undefined
      synth.cancel()
      if (mayRetry) void play(playback, false)
      else finish(playback, 'failed')
    })
    after(START_TIMEOUT_MS + speechTimeout(text, rate), () => {
      if (!isActive()) return
      synth.cancel()
      finish(playback)
    })
  }

  function markSpeaking(playback: Playback) {
    playback.status = 'speaking'
    emit()
    const poll = setInterval(() => {
      if (current === playback && !synth.speaking && !synth.pending) finish(playback)
    }, POLL_MS)
    timers.add(poll)
  }

  function finish(playback: Playback, failure?: SpeechFailure) {
    if (current !== playback) return
    clearTimers()
    current = null
    emit()
    keepAlive?.release()
    if (failure) onError(playback.request, failure)
  }

  function emit() {
    onChange(current ? { key: current.request.key, status: current.status } : null)
  }

  function after(ms: number, run: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer)
      run()
    }, ms)
    timers.add(timer)
  }

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }

  return { speak, stop, toggle }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface Playback {
  request: SpeechRequest
  requestedAt: number
  status: Exclude<SpeechStatus, 'idle'>
  utterance?: SpeechSynthesisUtterance
}

interface SpeechEngineOptions {
  createUtterance: (text: string) => SpeechSynthesisUtterance
  keepAlive?: KeepAlive
  onChange: (state: SpeechState | null) => void
  onError: (request: SpeechRequest, failure: SpeechFailure) => void
  synth: SpeechSynthesis
}
