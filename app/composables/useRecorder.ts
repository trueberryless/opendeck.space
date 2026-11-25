import { MAX_RECORDING_MS, micFailure, recordingType, type MicFailure } from '~/utils/recording'

export type RecorderState = 'idle' | 'starting' | 'recording'

let stopActive: (() => void) | null = null

export function recorderSupported(): boolean {
  return (
    import.meta.client &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

export function useRecorder() {
  const state = ref<RecorderState>('idle')
  const failure = ref<MicFailure | null>(null)
  const recording = shallowRef<Blob | null>(null)
  const url = ref<string | null>(null)
  const supported = ref(false)
  const explained = useLocalStorage('opendeck-mic-explained', false)
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let limit: ReturnType<typeof setTimeout> | undefined

  onMounted(() => (supported.value = recorderSupported()))
  onBeforeUnmount(() => {
    stop()
    release()
    clear()
  })

  async function start() {
    if (state.value !== 'idle') return
    stopActive?.()
    failure.value = null
    state.value = 'starting'
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (error) {
      state.value = 'idle'
      failure.value = micFailure(error)
      return
    }
    if (state.value !== 'starting') return release()

    const mimeType = recordingType((type) => MediaRecorder.isTypeSupported(type))
    const chunks: Blob[] = []
    const active = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorder = active
    active.addEventListener('dataavailable', (event) => {
      if (event.data.size) chunks.push(event.data)
    })
    active.addEventListener('stop', () => {
      release()
      if (recorder === active) recorder = null
      state.value = 'idle'
      if (!chunks.length) return
      clear()
      recording.value = new Blob(chunks, { type: active.mimeType || mimeType || 'audio/webm' })
      url.value = URL.createObjectURL(recording.value)
    })
    active.start()
    state.value = 'recording'
    stopActive = stop
    limit = setTimeout(stop, MAX_RECORDING_MS)
  }

  function stop() {
    clearTimeout(limit)
    if (stopActive === stop) stopActive = null
    if (state.value === 'starting') state.value = 'idle'
    if (recorder?.state === 'recording') recorder.stop()
  }

  function toggle() {
    if (state.value === 'idle') return start()
    stop()
  }

  function release() {
    for (const track of stream?.getTracks() ?? []) track.stop()
    stream = null
  }

  function clear() {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = null
    recording.value = null
  }

  return { clear, explained, failure, recording, start, state, stop, supported, toggle, url }
}
