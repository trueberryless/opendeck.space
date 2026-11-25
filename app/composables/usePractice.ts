import type { MaybeRefOrGetter } from 'vue'
import { DEFAULT_PREFS } from '~/composables/useProfile'
import { mixToMono, WHISPER_SAMPLE_RATE } from '~/utils/recording'
import { scoreSpeech, type SpeechScore } from '~/utils/speechScore'

export interface PracticeTarget {
  key?: number | string
  lang?: string
  readings?: (string | undefined)[]
  text: string
}

export interface PracticeResult extends SpeechScore {
  heard: string
}

export type Playing = 'native' | 'own' | null

async function decodeRecording(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE })
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer())
    return mixToMono(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)))
  } finally {
    void context.close()
  }
}

export function usePractice(target: MaybeRefOrGetter<PracticeTarget>) {
  const recorder = useRecorder()
  const speech = useSpeech()
  const models = useSpeechModels()
  const { prefs } = useProfile()
  const playing = ref<Playing>(null)
  const checking = ref(false)
  const checkFailed = ref(false)
  const asking = ref(false)
  const result = shallowRef<PracticeResult | null>(null)
  let audio: HTMLAudioElement | null = null

  const current = computed(() => toValue(target))
  const canPlayNative = computed(() => speech.canSpeak(current.value.lang))
  const canCheck = computed(() => models.canCheck(current.value.lang))

  watch([() => current.value.key, () => current.value.text], () => reset())

  watch(recorder.state, () => speech.stop())

  watch(recorder.recording, async (blob) => {
    result.value = null
    checkFailed.value = false
    if (!blob) return
    if ((prefs.value?.autoCheck ?? DEFAULT_PREFS.autoCheck) && models.active.value && canCheck.value) await check()
  })

  onMounted(() => {
    if (!models.checked.value) void models.refresh()
  })
  onBeforeUnmount(() => stopPlayback())

  async function playNative() {
    const { text, lang } = current.value
    if (!canPlayNative.value) return
    stopPlayback()
    playing.value = 'native'
    speech.speak(text, lang)
    await until(() => speech.isSpeaking(text, lang)).toBe(false)
    if (playing.value === 'native') playing.value = null
  }

  async function playOwn() {
    const url = recorder.url.value
    if (!url) return
    stopPlayback()
    const element = new Audio(url)
    audio = element
    playing.value = 'own'
    try {
      await new Promise<void>((resolve, reject) => {
        element.addEventListener('ended', () => resolve(), { once: true })
        element.addEventListener('pause', () => resolve(), { once: true })
        element.addEventListener('error', () => reject(new Error('playback failed')), { once: true })
        element.play().catch(reject)
      })
    } catch (err) {
      console.error('[opendeck] failed to play the recording', err)
    } finally {
      if (audio === element) {
        audio = null
        playing.value = null
      }
    }
  }

  function stopPlayback() {
    if (playing.value === 'native') speech.stop()
    audio?.pause()
    audio = null
    playing.value = null
  }

  async function check() {
    const blob = recorder.recording.value
    if (!blob || checking.value) return
    const { text, lang, readings } = current.value
    checking.value = true
    checkFailed.value = false
    try {
      const heard = await models.transcribe(await decodeRecording(blob), lang)
      if (blob === recorder.recording.value) result.value = { ...scoreSpeech(text, heard, lang, readings), heard }
    } catch (err) {
      console.error('[opendeck] failed to check the recording', err)
      checkFailed.value = true
    } finally {
      checking.value = false
    }
  }

  async function record() {
    if (recorder.state.value === 'idle' && !recorder.explained.value) {
      asking.value = true
      return
    }
    asking.value = false
    stopPlayback()
    speech.stop()
    await recorder.toggle()
  }

  async function allowMic() {
    recorder.explained.value = true
    await record()
  }

  function reset() {
    stopPlayback()
    recorder.stop()
    recorder.clear()
    result.value = null
    checkFailed.value = false
    asking.value = false
  }

  return {
    allowMic,
    asking,
    canCheck,
    canPlayNative,
    check,
    checkFailed,
    checking,
    current,
    models,
    playNative,
    playOwn,
    playing,
    record,
    recorder,
    reset,
    result,
    stopPlayback,
  }
}

export type Practice = ReturnType<typeof usePractice>
