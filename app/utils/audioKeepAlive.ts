const NOISE_LEVEL = 0.00003
const FADE_SECONDS = 0.08
const RESUME_TIMEOUT_MS = 300

export interface KeepAlive {
  acquire: () => Promise<void>
  release: () => void
}

export function createAudioKeepAlive(options: KeepAliveOptions = {}): KeepAlive {
  const { tailMs = 2000, warmupMs = 250 } = options
  let context: AudioContext | undefined
  let gain: GainNode | undefined
  let source: AudioBufferSourceNode | undefined
  let warmUntil = 0
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  let suspendTimer: ReturnType<typeof setTimeout> | undefined
  let previousSessionType: string | undefined
  let starting: Promise<void> | undefined
  let releaseRequested = false

  function acquire(): Promise<void> {
    releaseRequested = false
    clearTimeout(releaseTimer)
    clearTimeout(suspendTimer)
    releaseTimer = undefined
    if (source) return wait(warmUntil - Date.now())

    starting ??= warmUp().finally(() => {
      starting = undefined
      if (releaseRequested) release()
    })
    return starting
  }

  async function warmUp() {
    const ctx = getContext()
    if (!ctx) return
    setSessionType('transient')
    await Promise.race([ctx.resume().catch(() => {}), wait(RESUME_TIMEOUT_MS)])
    if (ctx.state !== 'running') return restoreSessionType()

    start(ctx)
    warmUntil = Date.now() + warmupMs
    return wait(warmupMs)
  }

  function release() {
    releaseRequested = Boolean(starting)
    if (!source || releaseTimer) return
    releaseTimer = setTimeout(stop, tailMs)
  }

  function getContext(): AudioContext | undefined {
    if (context) return context
    if (typeof AudioContext === 'undefined') return undefined
    try {
      context = new AudioContext({ latencyHint: 'interactive' })
    } catch {
      return undefined
    }
    return context
  }

  function start(ctx: AudioContext) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * NOISE_LEVEL

    gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_SECONDS)
    gain.connect(ctx.destination)
    source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    source.start()
  }

  function stop() {
    releaseTimer = undefined
    const ctx = context
    if (!ctx || !source || !gain) return

    const end = ctx.currentTime + FADE_SECONDS
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0, end)
    source.stop(end)
    source = undefined
    gain = undefined
    suspendTimer = setTimeout(
      () => {
        void ctx.suspend().catch(() => {})
        restoreSessionType()
      },
      FADE_SECONDS * 1000 + 50,
    )
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

  return { acquire, release }
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}

function audioSession(): { type: string } | undefined {
  return (navigator as Navigator & { audioSession?: { type: string } }).audioSession
}

interface KeepAliveOptions {
  tailMs?: number
  warmupMs?: number
}
