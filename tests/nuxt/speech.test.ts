import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SpeakButton from '~/components/SpeakButton.vue'
import StudyCard from '~/components/StudyCard.vue'
import VoiceInstallGuide from '~/components/VoiceInstallGuide.vue'
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
    const synth = stubSpeech([voice('de-DE', { name: 'Eddy (German (Germany))' }), voice('de-DE', { name: 'Anna' })])
    useProfile().prefs.value = { speechRate: 'slow' }
    const speech = await mountSpeech()

    expect(speech.supported.value).toBe(true)
    speech.speak('der Hund', 'de')

    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1))
    expect(synth.spoken[0]).toMatchObject({ text: 'der Hund.', lang: 'de-DE', rate: 0.7 })
    expect(synth.spoken[0]!.voice?.name).toBe('Anna')
  })

  it('uses the voice picked for the language on this device', async () => {
    const synth = stubSpeech([voice('de-DE', { name: 'Anna' }), voice('de-AT', { name: 'Helena' })])
    const speech = await mountSpeech()
    speech.preferredVoices.value = { de: 'Helena' }

    speech.speak('Servus', 'de-DE')
    await vi.waitFor(() => expect(synth.spoken[0]?.voice?.name).toBe('Helena'))
  })

  it('reports whether a text is being prepared, spoken or idle', async () => {
    const synth = stubSpeech()
    const speech = await mountSpeech()

    speech.toggle('hola', 'es')
    expect(speech.status('hola', 'es')).toBe('pending')
    expect(speech.status('hola', 'en')).toBe('idle')
    await vi.waitFor(() => expect(speech.status('hola', 'es')).toBe('speaking'))
    synth.end()
    expect(speech.status('hola', 'es')).toBe('idle')
  })

  it('picks up voices that load later', async () => {
    const synth = stubSpeech([])
    const speech = await mountSpeech()

    expect(speech.canSpeak('ja')).toBe(false)
    synth.setVoices([voice('ja-JP')])
    expect(speech.canSpeak('ja')).toBe(true)
    expect(speech.voicesFor('ja')).toHaveLength(1)
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
    await new Promise((resolve) => setTimeout(resolve, 10))
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
    await vi.waitFor(() => expect(spokenTexts(synth)).toEqual(['hello.']))
  })

  it('tells the learner when a voice fails, but not when the browser blocks automatic reading', async () => {
    const synth = stubSpeech()
    const speech = await mountSpeech()
    const toasts = useToast().toasts

    useProfile().prefs.value = { autoSpeak: 'prompt' }
    speech.autoSpeak('prompt', 'hola', 'es')
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1))
    synth.fail('not-allowed')

    speech.speak('hola', 'es')
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(2))
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
    expect(button.attributes('aria-label')).toBe('Stop reading aloud')
    await vi.waitFor(() => expect(spokenTexts(synth)).toEqual(['hola.']))

    synth.end()
    await vi.waitFor(() => expect(button.attributes('aria-label')).toBe('Read aloud: hola'))
  })

  it('stops reading when it goes away', async () => {
    const synth = stubSpeech()
    const wrapper = await mountSuspended(SpeakButton, { props: { text: 'hola', lang: 'es' } })
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(synth.speaking).toBe(true))
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
    await wrapper.vm.$nextTick()
    expect(JSON.parse(localStorage.getItem('opendeck-voice-choices')!)).toEqual({ de: 'Google Deutsch' })

    await wrapper.get('button[aria-label="Test the German voice"]').trigger('click')
    await vi.waitFor(() => expect(synth.spoken[0]).toMatchObject({ text: 'Deutsch.' }))
    expect(synth.spoken[0]!.voice?.name).toBe('Google Deutsch')

    select.vm.$emit('update:modelValue', 'auto')
    await wrapper.vm.$nextTick()
    expect(JSON.parse(localStorage.getItem('opendeck-voice-choices')!)).toEqual({})
  })

  it('renders nothing for a language without voices', async () => {
    stubSpeech([voice('en-US')])
    const wrapper = await mountSuspended(VoicePicker, { props: { lang: 'ja' } })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})

const MAC_FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/150.0 Mobile Safari/537.36'

describe('VoiceInstallGuide', () => {
  it('opens the Spoken Content settings on a Mac and explains Firefox there', async () => {
    stubNavigator({ userAgent: MAC_FIREFOX, maxTouchPoints: 0 })
    const wrapper = await mountSuspended(VoiceInstallGuide)
    expect(wrapper.text()).toContain('Manage Voices')
    expect(wrapper.text()).toContain('Firefox on Mac')
    expect(wrapper.get('a').attributes('href')).toBe(
      'x-apple.systempreferences:com.apple.preference.universalaccess?SpokenContent',
    )
  })

  it('walks Android users to the Google speech services', async () => {
    stubNavigator({ userAgent: ANDROID, maxTouchPoints: 5 })
    const wrapper = await mountSuspended(VoiceInstallGuide)
    expect(wrapper.text()).toContain('Install voice data')
    expect(wrapper.find('a').exists()).toBe(false)
  })
})

describe('VoicePicker on Apple devices', () => {
  it('points out when only a basic voice is installed', async () => {
    stubNavigator({ userAgent: MAC_FIREFOX, maxTouchPoints: 0 })
    stubSpeech([voice('de-DE', { name: 'Anna' }), voice('ja-JP', { name: 'Kyoko (Enhanced)' })])
    const basic = await mountSuspended(VoicePicker, { props: { lang: 'de' } })
    const natural = await mountSuspended(VoicePicker, { props: { lang: 'ja' } })
    expect(basic.text()).toContain('Only a basic voice is installed')
    expect(natural.text()).not.toContain('Only a basic voice is installed')
  })
})
