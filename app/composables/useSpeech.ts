import { useI18n } from 'vue-i18n'
import { DEFAULT_PREFS } from '~/composables/useProfile'
import { findVoice, rankVoices, shouldAutoSpeak, speechLanguage, speechRateValue, type CardSide } from '~/utils/speech'
import { createSpeechEngine, type SpeechEngine } from '~/utils/speechEngine'

const VOICES_SETTLE_MS = 1500

export function useSpeech() {
  const supported = useState('opendeck-speech-supported', () => false)
  const voicesReady = useState('opendeck-speech-voices-ready', () => false)
  const voices = useState<SpeechSynthesisVoice[]>('opendeck-speech-voices', () => [])
  const speakingKey = useState<string | null>('opendeck-speech-key', () => null)
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
    engine.value = markRaw(
      createSpeechEngine({
        synth,
        createUtterance: (text) => new SpeechSynthesisUtterance(text),
        onChange: (key) => (speakingKey.value = key),
        onError: (request, failure) => {
          if (request.auto && failure === 'not-allowed') return
          toast.add({ title: t('speech.failed'), description: t('speech.failedHelp'), color: 'error' })
        },
      }),
    )
    const loadVoices = () => {
      voices.value = synth.getVoices()
      if (voices.value.length) voicesReady.value = true
    }
    loadVoices()
    synth.addEventListener('voiceschanged', () => {
      loadVoices()
      voicesReady.value = true
    })
    setTimeout(() => (voicesReady.value = true), VOICES_SETTLE_MS)
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

  function isSpeaking(text: string, lang: string | undefined): boolean {
    return speakingKey.value === speechKey(text, lang)
  }

  function buildRequest(text: string, lang: string | undefined, auto = false) {
    const voice = voiceFor(lang)
    if (!voice || !text.trim()) return undefined
    const rate = speechRateValue(prefs.value?.speechRate ?? DEFAULT_PREFS.speechRate)
    return { auto, key: speechKey(text, lang), rate, text, voice }
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

  return {
    autoSpeak,
    canSpeak,
    isSpeaking,
    preferredVoices,
    speak,
    stop,
    supported,
    toggle,
    voicesFor,
    voicesReady,
  }
}

function getSynth(): SpeechSynthesis | undefined {
  return import.meta.client && 'speechSynthesis' in window ? window.speechSynthesis : undefined
}

function speechKey(text: string, lang: string | undefined): string {
  return `${lang ?? ''}\u0000${text}`
}
