const CANCEL_SETTLE_MS = 120
const START_TIMEOUT_MS = 2500
const POLL_MS = 250
const REPEAT_GUARD_MS = 400
const IGNORED_ERRORS = new Set(['canceled', 'interrupted'])

export type SpeechFailure = 'failed' | 'not-allowed'

export interface SpeechRequest {
  auto?: boolean
  key: string
  rate: number
  text: string
  voice: SpeechSynthesisVoice
}

export interface SpeechEngine {
  speak: (request: SpeechRequest) => void
  stop: () => void
  toggle: (request: SpeechRequest) => void
}

export function createSpeechEngine(options: SpeechEngineOptions): SpeechEngine {
  const { createUtterance, onChange, onError, synth } = options
  let current: Playback | null = null
  let cancelledAt = Number.NEGATIVE_INFINITY
  const timers = new Set<ReturnType<typeof setTimeout>>()

  function speak(request: SpeechRequest) {
    clearTimers()
    const playback: Playback = { request, requestedAt: Date.now() }
    current = playback
    onChange(request.key)
    if (synth.speaking || synth.pending) cancel()

    const settle = cancelledAt + CANCEL_SETTLE_MS - Date.now()
    if (settle > 0) after(settle, () => play(playback))
    else play(playback)
  }

  function toggle(request: SpeechRequest) {
    if (current?.request.key !== request.key) return speak(request)
    if (Date.now() - current.requestedAt >= REPEAT_GUARD_MS) stop()
  }

  function stop() {
    if (!current) return
    clearTimers()
    current = null
    cancel()
    onChange(null)
  }

  function cancel() {
    synth.cancel()
    cancelledAt = Date.now()
  }

  function play(playback: Playback) {
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
      if (isActive()) watchEnd(playback)
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
      if (!isActive() || playback.started) return
      if (synth.speaking) return watchEnd(playback)
      cancel()
      finish(playback, 'failed')
    })
  }

  function watchEnd(playback: Playback) {
    playback.started = true
    const poll = setInterval(() => {
      if (current === playback && !synth.speaking && !synth.pending) finish(playback)
    }, POLL_MS)
    timers.add(poll)
  }

  function finish(playback: Playback, failure?: SpeechFailure) {
    if (current !== playback) return
    clearTimers()
    current = null
    onChange(null)
    if (failure) onError(playback.request, failure)
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

interface Playback {
  request: SpeechRequest
  requestedAt: number
  started?: boolean
  utterance?: SpeechSynthesisUtterance
}

interface SpeechEngineOptions {
  createUtterance: (text: string) => SpeechSynthesisUtterance
  onChange: (key: string | null) => void
  onError: (request: SpeechRequest, failure: SpeechFailure) => void
  synth: SpeechSynthesis
}
