import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import SpeakButton from '~/components/SpeakButton.vue'
import StudyCard from '~/components/StudyCard.vue'
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

describe('useSpeech', () => {
  it('speaks text with the voice and rate for its language', async () => {
    const { spoken, synth } = stubSpeech([voice('en-US'), voice('es-MX')])
    useProfile().prefs.value = { speechRate: 'slow' }
    const speech = await mountSpeech()

    expect(speech.supported.value).toBe(true)
    speech.speak('hola', 'es')

    expect(synth.cancel).toHaveBeenCalled()
    expect(spoken).toHaveLength(1)
    expect(spoken[0]).toMatchObject({ text: 'hola', lang: 'es-MX', rate: 0.7 })
    expect(spoken[0]!.voice?.lang).toBe('es-MX')
  })

  it('tracks what is being spoken until it ends or is stopped', async () => {
    const { spoken, synth } = stubSpeech()
    const speech = await mountSpeech()

    speech.toggle('hola', 'es')
    expect(speech.isSpeaking('hola', 'es')).toBe(true)
    expect(speech.isSpeaking('hola', 'en')).toBe(false)
    spoken[0]!.finish()
    expect(speech.isSpeaking('hola', 'es')).toBe(false)

    speech.toggle('hola', 'es')
    speech.toggle('hola', 'es')
    expect(speech.isSpeaking('hola', 'es')).toBe(false)
    expect(synth.cancel).toHaveBeenCalledTimes(3)
  })

  it('ignores the end of an utterance that was replaced', async () => {
    const { spoken } = stubSpeech()
    const speech = await mountSpeech()

    speech.speak('hola', 'es')
    speech.speak('adiós', 'es')
    spoken[0]!.finish()
    expect(speech.isSpeaking('adiós', 'es')).toBe(true)
  })

  it('picks up voices that load later', async () => {
    const { setVoices } = stubSpeech([])
    const speech = await mountSpeech()

    expect(speech.canSpeak('ja')).toBe(false)
    setVoices([voice('ja-JP')])
    expect(speech.canSpeak('ja')).toBe(true)
  })

  it('skips network voices while offline', async () => {
    stubNavigator({ onLine: false })
    stubSpeech([voice('fr-FR', { localService: false }), voice('de-DE')])
    const speech = await mountSpeech()

    expect(speech.canSpeak('fr')).toBe(false)
    expect(speech.canSpeak('de')).toBe(true)
  })

  it('does nothing without a voice, text or speech support', async () => {
    const { spoken } = stubSpeech()
    const speech = await mountSpeech()
    speech.speak('안녕', 'ko')
    speech.speak('   ', 'es')
    speech.speak('hola', undefined)
    expect(spoken).toHaveLength(0)
  })

  it('reports no support when the browser has no speech synthesis', async () => {
    const speech = await mountSpeech()
    expect(speech.supported.value).toBe(false)
    expect(speech.canSpeak('en')).toBe(false)
    expect(() => speech.speak('hello', 'en')).not.toThrow()
  })

  it('reads sides aloud automatically as the preference asks', async () => {
    const { spoken } = stubSpeech()
    const speech = await mountSpeech()

    speech.autoSpeak('prompt', 'hola', 'es')
    expect(spoken).toHaveLength(0)

    useProfile().prefs.value = { autoSpeak: 'answer' }
    speech.autoSpeak('prompt', 'hola', 'es')
    speech.autoSpeak('answer', 'hello', 'en')
    expect(spoken.map((u) => u.text)).toEqual(['hello'])
  })
})

describe('SpeakButton', () => {
  it('renders nothing when the device has no voice for the language', async () => {
    stubSpeech([voice('en-US')])
    const wrapper = await mountSuspended(SpeakButton, { props: { text: 'hola', lang: 'es' } })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('reads the text aloud and offers to stop', async () => {
    const { spoken } = stubSpeech()
    const wrapper = await mountSuspended(SpeakButton, { props: { text: 'hola', lang: 'es', keyshortcuts: 'S' } })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Read aloud: hola')
    expect(button.attributes('aria-keyshortcuts')).toBe('S')

    await button.trigger('click')
    expect(spoken.map((u) => u.text)).toEqual(['hola'])
    expect(button.attributes('aria-label')).toBe('Stop reading aloud')

    spoken[0]!.finish()
    await nextTick()
    expect(button.attributes('aria-label')).toBe('Read aloud: hola')
  })

  it('stops reading when it goes away', async () => {
    const { synth } = stubSpeech()
    const wrapper = await mountSuspended(SpeakButton, { props: { text: 'hola', lang: 'es' } })
    await wrapper.get('button').trigger('click')
    const cancels = synth.cancel.mock.calls.length
    wrapper.unmount()
    expect(synth.cancel).toHaveBeenCalledTimes(cancels + 1)
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
