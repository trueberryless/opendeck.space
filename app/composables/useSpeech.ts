import { useI18n } from 'vue-i18n'
import { DEFAULT_PREFS } from '~/composables/useProfile'
import { createAudioFocus } from '~/utils/audioFocus'
import {
  detectSpeechPlatform,
  findVoice,
  isFirefox,
  prepareSpeechText,
  rankVoices,
  shouldAutoSpeak,
  speechLanguage,
  speechRateValue,
  type CardSide,
  type SpeechPlatform,
} from '~/utils/speech'
import { createSpeechEngine, type SpeechEngine, type SpeechState, type SpeechStatus } from '~/utils/speechEngine'

export function useSpeech() {
  const supported = useState('opendeck-speech-supported', () => false)
  const voices = useState<SpeechSynthesisVoice[]>('opendeck-speech-voices', () => [])
  const state = useState<SpeechState | null>('opendeck-speech-state', () => null)
  const engine = useState<SpeechEngine | null>('opendeck-speech-engine', () => null)
  const preferredVoices = useLocalStorage<Record<string, string>>('opendeck-voice-choices', {})
  const online = useOnline()
  const { prefs } = useProfile()
  const toast = useToast()
  const { t } = useI18n()

  onMounted(() => {
    const synth = getSynth()
    if (!synth || engine.value) return
    supported.value = true
    const audioFocus = createAudioFocus()
    audioFocus.prepare()
    engine.value = markRaw(
      createSpeechEngine({
        synth,
        audioFocus,
        createUtterance: (text) => new SpeechSynthesisUtterance(text),
        onChange: (next) => (state.value = next),
        onError: (request, failure) => {
          if (request.auto && failure === 'not-allowed') return
          toast.add({ title: t('speech.failed'), description: t('speech.failedHelp'), color: 'error' })
        },
      }),
    )
    const loadVoices = () => (voices.value = synth.getVoices())
    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)
  })

  function voicesFor(lang: string | undefined) {
    return rankVoices(voices.value, lang, { offline: !online.value }).map((v) => toRaw(v))
  }

  function voiceFor(lang: string | undefined) {
    const preferred = preferredVoices.value[speechLanguage(lang) ?? '']
    const voice = findVoice(voices.value, lang, { offline: !online.value, preferred })
    return voice ? toRaw(voice) : undefined
  }

  function canSpeak(lang: string | undefined): boolean {
    return Boolean(voiceFor(lang))
  }

  function status(text: string, lang: string | undefined): SpeechStatus {
    return state.value?.key === speechKey(text, lang) ? state.value.status : 'idle'
  }

  function buildRequest(text: string, lang: string | undefined, auto = false) {
    const voice = voiceFor(lang)
    const prepared = prepareSpeechText(text, lang)
    if (!voice || !prepared) return undefined
    const rate = speechRateValue(prefs.value?.speechRate ?? DEFAULT_PREFS.speechRate)
    return { auto, key: speechKey(text, lang), rate, text: prepared, voice }
  }

  function speak(text: string, lang: string | undefined) {
    const next = buildRequest(text, lang)
    if (next) engine.value?.speak(next)
  }

  function toggle(text: string, lang: string | undefined) {
    const next = buildRequest(text, lang)
    if (next) engine.value?.toggle(next)
  }

  function autoSpeak(side: CardSide, text: string, lang: string | undefined) {
    if (!shouldAutoSpeak(prefs.value?.autoSpeak ?? DEFAULT_PREFS.autoSpeak, side)) return
    const next = buildRequest(text, lang, true)
    if (next) engine.value?.speak(next)
  }

  function stop() {
    engine.value?.stop()
  }

  return { autoSpeak, canSpeak, preferredVoices, speak, status, stop, supported, toggle, voicesFor }
}

export function useSpeechPlatform() {
  const platform = ref<SpeechPlatform>('other')
  const firefox = ref(false)
  onMounted(() => {
    platform.value = detectSpeechPlatform(navigator.userAgent, navigator.maxTouchPoints)
    firefox.value = isFirefox(navigator.userAgent)
  })
  return { firefox, platform }
}

function getSynth(): SpeechSynthesis | undefined {
  return import.meta.client && 'speechSynthesis' in window ? window.speechSynthesis : undefined
}

function speechKey(text: string, lang: string | undefined): string {
  return `${lang ?? ''}\u0000${text}`
}
