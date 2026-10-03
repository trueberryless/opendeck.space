import { DEFAULT_PREFS } from '~/composables/useProfile'
import { findVoice, shouldAutoSpeak, speechRateValue, type CardSide } from '~/utils/speech'

const utterances = new Set<SpeechSynthesisUtterance>()

export function useSpeech() {
  const supported = useState('opendeck-speech-supported', () => false)
  const voices = useState<SpeechSynthesisVoice[]>('opendeck-speech-voices', () => [])
  const speaking = useState<{ id: number; key: string } | null>('opendeck-speech-speaking', () => null)
  const nextId = useState('opendeck-speech-next-id', () => 0)
  const online = useOnline()
  const { prefs } = useProfile()

  onMounted(() => {
    const synth = getSynth()
    if (!synth || supported.value) return
    supported.value = true
    const loadVoices = () => (voices.value = synth.getVoices())
    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)
  })

  function voiceFor(lang: string | undefined) {
    const voice = findVoice(voices.value, lang, { offline: !online.value })
    return voice ? toRaw(voice) : undefined
  }

  function canSpeak(lang: string | undefined): boolean {
    return Boolean(voiceFor(lang))
  }

  function isSpeaking(text: string, lang: string | undefined): boolean {
    return speaking.value?.key === speechKey(text, lang)
  }

  function speak(text: string, lang: string | undefined) {
    const synth = getSynth()
    const voice = voiceFor(lang)
    if (!synth || !voice || !text.trim()) return

    synth.cancel()
    const id = ++nextId.value
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = speechRateValue(prefs.value?.speechRate ?? DEFAULT_PREFS.speechRate)
    const finish = () => {
      utterances.delete(utterance)
      if (speaking.value?.id === id) speaking.value = null
    }
    utterance.addEventListener('end', finish)
    utterance.addEventListener('error', finish)
    utterances.add(utterance)
    speaking.value = { id, key: speechKey(text, lang) }
    synth.speak(utterance)
  }

  function stop() {
    speaking.value = null
    getSynth()?.cancel()
  }

  function autoSpeak(side: CardSide, text: string, lang: string | undefined) {
    if (shouldAutoSpeak(prefs.value?.autoSpeak ?? DEFAULT_PREFS.autoSpeak, side)) speak(text, lang)
  }

  function toggle(text: string, lang: string | undefined) {
    if (isSpeaking(text, lang)) stop()
    else speak(text, lang)
  }

  return { autoSpeak, canSpeak, isSpeaking, speak, stop, supported, toggle }
}

function getSynth(): SpeechSynthesis | undefined {
  return import.meta.client && 'speechSynthesis' in window ? window.speechSynthesis : undefined
}

function speechKey(text: string, lang: string | undefined): string {
  return `${lang ?? ''}\u0000${text}`
}
