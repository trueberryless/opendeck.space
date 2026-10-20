import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SpeakButton from '~/components/SpeakButton.vue'
import StudyCard from '~/components/StudyCard.vue'
import VoicePicker from '~/components/VoicePicker.vue'
import { stubNavigator } from '../support/navigator'
import { stubSpeech, voice } from '../support/speech'
import '../support/reset'

enableAutoUnmount(afterEach)

async function mountSpeech() {
  let api!: ReturnType<typeof useSpeech>
  await mountSuspended(
    defineComponent({
      setup() {
        api = useSpeech()
        return () => h('div')
      },
    }),
  )
  return api
}

const spokenTexts = (synth: ReturnType<typeof stubSpeech>) => synth.spoken.map((u) => u.text)

describe('useSpeech', () => {
  it('speaks with the best voice for the language at the chosen rate', async () => {
    const synth = stubSpeech([voice('ja-JP', { name: 'Eddy (Japanese (Japan))' }), voice('ja-JP', { name: 'Kyoko' })])
    useProfile().prefs.value = { speechRate: 'slow' }
    const speech = await mountSpeech()

    expect(speech.supported.value).toBe(true)
    speech.speak('犬', 'ja')

    expect(synth.spoken[0]).toMatchObject({ text: '犬', lang: 'ja-JP', rate: 0.7 })
    expect(synth.spoken[0]!.voice?.name).toBe('Kyoko')
  })

  it('uses the voice picked for the language on this device', async () => {
    const synth = stubSpeech([voice('de-DE', { name: 'Anna' }), voice('de-AT', { name: 'Helena' })])
    const speech = await mountSpeech()
    speech.preferredVoices.value = { de: 'Helena' }

    speech.speak('Servus', 'de-DE')
    expect(synth.spoken[0]?.voice?.name).toBe('Helena')
  })

  it('knows which text is being read until it ends or is stopped', async () => {
    const synth = stubSpeech()
    const speech = await mountSpeech()

    speech.toggle('hola', 'es')
    expect(speech.isSpeaking('hola', 'es')).toBe(true)
    expect(speech.isSpeaking('hola', 'en')).toBe(false)
    synth.end()
    expect(speech.isSpeaking('hola', 'es')).toBe(false)

    speech.speak('adiós', 'es')
    speech.stop()
    expect(speech.isSpeaking('adiós', 'es')).toBe(false)
  })

  it('picks up voices that load later', async () => {
    const synth = stubSpeech([])
    const speech = await mountSpeech()

    expect(speech.canSpeak('ja')).toBe(false)
    expect(speech.voicesReady.value).toBe(false)
    synth.setVoices([voice('ja-JP')])
    expect(speech.canSpeak('ja')).toBe(true)
    expect(speech.voicesReady.value).toBe(true)
  })

  it('skips network voices while offline', async () => {
    stubNavigator({ onLine: false })
    stubSpeech([voice('fr-FR', { localService: false }), voice('de-DE')])
    const speech = await mountSpeech()

    expect(speech.canSpeak('fr')).toBe(false)
    expect(speech.canSpeak('de')).toBe(true)
  })

  it('does nothing without a voice, text or speech support', async () => {
    const synth = stubSpeech()
    const speech = await mountSpeech()
    speech.speak('안녕', 'ko')
    speech.speak('   ', 'es')
    speech.toggle('hola', undefined)
    speech.stop()
    expect(synth.spoken).toHaveLength(0)
  })

  it('reports no support when the browser has no speech synthesis', async () => {
    const speech = await mountSpeech()
    expect(speech.supported.value).toBe(false)
    expect(speech.canSpeak('en')).toBe(false)
    expect(() => speech.speak('hello', 'en')).not.toThrow()
  })

  it('reads sides aloud automatically as the preference asks', async () => {
    const synth = stubSpeech()
    const speech = await mountSpeech()

    speech.autoSpeak('prompt', 'hola', 'es')
    useProfile().prefs.value = { autoSpeak: 'answer' }
    speech.autoSpeak('prompt', 'hola', 'es')
    speech.autoSpeak('answer', 'hello', 'en')
    speech.autoSpeak('answer', 'hola', 'ko')
    expect(spokenTexts(synth)).toEqual(['hello'])
  })

  it('tells the learner when a voice fails, but not when the browser blocks automatic reading', async () => {
    const synth = stubSpeech()
    const speech = await mountSpeech()
    const toasts = useToast().toasts

    useProfile().prefs.value = { autoSpeak: 'prompt' }
    speech.autoSpeak('prompt', 'hola', 'es')
    synth.fail('not-allowed')

    speech.speak('hola', 'es')
    synth.fail('synthesis-failed')
    await vi.waitFor(() => expect(toasts.value.map((toast) => toast.title)).toEqual(["Couldn't read this aloud"]))
  })
})

describe('SpeakButton', () => {
  it('renders nothing when the device has no voice for the language', async () => {
    stubSpeech([voice('en-US')])
    const wrapper = await mountSuspended(SpeakButton, { props: { text: 'hola', lang: 'es' } })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('reads the text aloud and offers to stop', async () => {
    const synth = stubSpeech()
    const wrapper = await mountSuspended(SpeakButton, { props: { text: 'hola', lang: 'es', keyshortcuts: 'S' } })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Read aloud: hola')
    expect(button.attributes('aria-keyshortcuts')).toBe('S')

    await button.trigger('click')
    expect(spokenTexts(synth)).toEqual(['hola'])
    expect(button.attributes('aria-label')).toBe('Stop reading aloud')

    synth.end()
    await nextTick()
    expect(button.attributes('aria-label')).toBe('Read aloud: hola')
  })

  it('stops reading when it goes away', async () => {
    const synth = stubSpeech()
    const wrapper = await mountSuspended(SpeakButton, { props: { text: 'hola', lang: 'es' } })
    await wrapper.get('button').trigger('click')
    expect(synth.speaking).toBe(true)
    wrapper.unmount()
    expect(synth.speaking).toBe(false)
  })
})

describe('StudyCard read aloud', () => {
  it('offers to read the front, and the back once revealed', async () => {
    stubSpeech()
    const props = { front: 'hola', back: 'hello', frontLang: 'es', backLang: 'en', showHint: false, revealed: false }
    const wrapper = await mountSuspended(StudyCard, { props })
    const labels = () => wrapper.findAll('button').map((b) => b.attributes('aria-label'))
    expect(labels()).toEqual(['Read aloud: hola'])

    await wrapper.setProps({ revealed: true })
    expect(labels()).toEqual(['Read aloud: hola', 'Read aloud: hello'])
  })
})

describe('VoicePicker', () => {
  it('lists the voices for a language, best first, and tests the chosen one', async () => {
    const synth = stubSpeech([
      voice('de-DE', { name: 'Eddy (German (Germany))' }),
      voice('de-DE', { name: 'Google Deutsch', localService: false }),
      voice('de-DE', { name: 'Anna' }),
    ])
    const wrapper = await mountSuspended(VoicePicker, { props: { lang: 'de' } })
    const select = wrapper.findComponent({ name: 'USelect' })
    expect(select.props('items')).toEqual([
      { value: 'auto', label: 'Automatic (Anna)' },
      { value: 'Anna', label: 'Anna' },
      { value: 'Google Deutsch', label: 'Google Deutsch (online)' },
      { value: 'Eddy (German (Germany))', label: 'Eddy (German (Germany))' },
    ])

    select.vm.$emit('update:modelValue', 'Google Deutsch')
    await nextTick()
    expect(JSON.parse(localStorage.getItem('opendeck-voice-choices')!)).toEqual({ de: 'Google Deutsch' })

    await wrapper.get('button[aria-label="Test the German voice"]').trigger('click')
    expect(synth.spoken[0]).toMatchObject({ text: 'Deutsch' })
    expect(synth.spoken[0]!.voice?.name).toBe('Google Deutsch')

    select.vm.$emit('update:modelValue', 'auto')
    await nextTick()
    expect(JSON.parse(localStorage.getItem('opendeck-voice-choices')!)).toEqual({})
  })

  it('says when the device has no voice for a language, once the voices have loaded', async () => {
    const synth = stubSpeech([])
    const wrapper = await mountSuspended(VoicePicker, { props: { lang: 'ja' } })
    expect(wrapper.text()).toBe('')

    synth.setVoices([voice('en-US')])
    await nextTick()
    expect(wrapper.text()).toContain('This device has no voice for Japanese')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
