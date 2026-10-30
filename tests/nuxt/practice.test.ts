import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConversationHandoff from '~/components/ConversationHandoff.vue'
import PracticePanel from '~/components/PracticePanel.vue'
import SpeechDiff from '~/components/SpeechDiff.vue'
import SpeechModels from '~/components/SpeechModels.vue'
import type { CardView, DeckView } from '~/composables/useDecks'
import { _resetSpeechModels } from '~/composables/useSpeechModels'
import type { PracticeTarget } from '~/composables/usePractice'
import type { ProgressRecord } from '~/composables/useStudy'
import { modelPrefix, RUNTIME_PREFIX, SPEECH_MODELS } from '~/utils/speechModels'
import { FakeAudio, FakeWorker, stubCaches, stubMicrophone, stubPlayback, stubWorker } from '../support/media'
import { stubSpeech } from '../support/speech'
import '../support/reset'

enableAutoUnmount(afterEach)

const [BASE, SMALL] = SPEECH_MODELS
const ENCODER = `${modelPrefix(BASE)}resolve/main/onnx/encoder_model_quantized.onnx`
const RUNTIME = `${RUNTIME_PREFIX}1.31.0/dist/ort-wasm-simd-threaded.asyncify.wasm`

async function mountWith<T>(setup: () => T): Promise<T> {
  let api!: T
  await mountSuspended(
    defineComponent({
      setup() {
        api = setup()
        return () => h('div')
      },
    }),
  )
  return api
}

beforeEach(() => {
  _resetSpeechModels()
})

describe('useRecorder', () => {
  it('records the microphone and releases it when stopped', async () => {
    const { getUserMedia, streams } = stubMicrophone()
    const recorder = await mountWith(() => useRecorder())
    expect(recorder.supported.value).toBe(true)

    await recorder.start()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: true } })
    expect(recorder.state.value).toBe('recording')

    recorder.stop()
    expect(recorder.state.value).toBe('idle')
    expect(recorder.recording.value?.type).toBe('audio/webm;codecs=opus')
    expect(recorder.url.value).toBe('blob:recording')
    expect(streams[0]?.tracks[0]?.stopped).toBe(true)
  })

  it('reports a refused or missing microphone', async () => {
    stubMicrophone({ deny: 'NotAllowedError' })
    const recorder = await mountWith(() => useRecorder())
    await recorder.toggle()
    expect(recorder.failure.value).toBe('denied')
    expect(recorder.state.value).toBe('idle')
  })

  it('stops the other recording when a second one starts', async () => {
    stubMicrophone()
    const [first, second] = await mountWith(() => [useRecorder(), useRecorder()])
    await first?.start()
    await second?.start()
    expect(first?.state.value).toBe('idle')
    expect(first?.recording.value).toBeTruthy()
    expect(second?.state.value).toBe('recording')
  })

  it('stops by itself after thirty seconds', async () => {
    vi.useFakeTimers()
    try {
      stubMicrophone()
      const recorder = await mountWith(() => useRecorder())
      await recorder.start()
      vi.advanceTimersByTime(30_000)
      expect(recorder.state.value).toBe('idle')
      expect(recorder.recording.value).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('is not offered without MediaRecorder', async () => {
    const recorder = await mountWith(() => useRecorder())
    expect(recorder.supported.value).toBe(false)
  })
})

describe('useSpeechModels', () => {
  it('downloads a model in the worker and shows its progress', async () => {
    const cache = stubCaches()
    const worker = stubWorker()
    const models = await mountWith(() => useSpeechModels())

    const done = models.download('base')
    expect(models.stateOf('base').status).toBe('downloading')
    const request = worker().last()
    expect(request).toMatchObject({ type: 'load', model: 'base', localOnly: false })

    worker().reply({
      type: 'progress',
      id: request.id,
      file: 'onnx/encoder.onnx',
      loaded: 37_500_000,
      total: 40_000_000,
    })
    expect(models.stateOf('base').progress).toBe(0.5)

    cache.file(ENCODER, 23_000_000)
    cache.file(RUNTIME, 27_000_000)
    worker().reply({ type: 'loaded', id: request.id })
    await done

    expect(models.stateOf('base').status).toBe('ready')
    expect(models.active.value).toBe('base')
    expect(models.sizes.value.base).toBe(23_000_000)
    expect(models.runtimeCached.value).toBe(true)
    expect(localStorage.getItem('opendeck-speech-models')).toBe('["base"]')
  })

  it('treats files left over from an interrupted download as not downloaded', async () => {
    stubCaches().file(ENCODER, 23_000_000)
    const models = await mountWith(() => useSpeechModels())
    await models.refresh()
    expect(models.stateOf('base').status).toBe('missing')
    expect(models.active.value).toBeUndefined()
  })

  it('cancels a download and removes what it saved', async () => {
    const cache = stubCaches()
    const worker = stubWorker()
    const models = await mountWith(() => useSpeechModels())
    const done = models.download('small')
    cache.file(`${modelPrefix(SMALL)}resolve/main/config.json`, 2000)

    await models.cancel('small')
    await done
    expect(worker().terminated).toBe(true)
    expect(cache.entries.size).toBe(0)
    expect(models.stateOf('small').status).toBe('missing')
  })

  it('shows a failed download until it is retried', async () => {
    stubCaches()
    const worker = stubWorker()
    const models = await mountWith(() => useSpeechModels())
    const done = models.download('base')
    worker().reply({ type: 'error', id: worker().last().id, message: 'Failed to fetch' })
    await done
    expect(models.stateOf('base')).toMatchObject({ status: 'error', error: 'Failed to fetch' })
  })

  it('deletes a model and the runtime once no model is left', async () => {
    const cache = stubCaches()
    cache.file(ENCODER, 23_000_000)
    cache.file(RUNTIME, 27_000_000)
    localStorage.setItem('opendeck-speech-models', '["base"]')
    localStorage.setItem('opendeck-speech-model', 'base')
    const models = await mountWith(() => useSpeechModels())
    await models.refresh()
    expect(models.ready.value).toEqual(['base'])

    await models.remove('base')
    expect(cache.entries.size).toBe(0)
    expect(models.ready.value).toEqual([])
    expect(models.preferred.value).toBe('')
  })

  it('transcribes on the device in the language of the card', async () => {
    const cache = stubCaches()
    cache.file(ENCODER, 1)
    localStorage.setItem('opendeck-speech-models', '["base"]')
    const worker = stubWorker()
    const models = await mountWith(() => useSpeechModels())
    await models.refresh()

    const text = models.transcribe(new Float32Array([0.1]), 'ja-JP')
    const request = worker().last()
    expect(request).toMatchObject({ type: 'transcribe', model: 'base', language: 'ja', localOnly: true })
    worker().reply({ type: 'result', id: request.id, text: 'こんにちは' })
    expect(await text).toBe('こんにちは')
    expect(models.canCheck('ckb')).toBe(false)
  })

  it('refuses to transcribe without a model', async () => {
    stubCaches()
    const models = await mountWith(() => useSpeechModels())
    await expect(models.transcribe(new Float32Array(), 'es')).rejects.toThrow('No speech model')
  })
})

describe('usePractice', () => {
  async function practise(target: PracticeTarget, prefs = {}) {
    useProfile().prefs.value = prefs
    return mountWith(() => usePractice(() => target))
  }

  async function recordOnce(practice: Awaited<ReturnType<typeof practise>>) {
    await practice.record()
    practice.recorder.stop()
    await nextTick()
  }

  it('explains the microphone once before asking for it', async () => {
    const { getUserMedia } = stubMicrophone()
    const practice = await practise({ text: 'hola', lang: 'es' })

    await practice.record()
    expect(practice.asking.value).toBe(true)
    expect(getUserMedia).not.toHaveBeenCalled()

    await practice.allowMic()
    expect(practice.asking.value).toBe(false)
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('opendeck-mic-explained')).toBe('true')
  })

  it('plays the voice and then the recording after each take', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    stubMicrophone()
    const synth = stubSpeech()
    const audio = stubPlayback()
    const practice = await practise({ text: 'hola', lang: 'es' })

    await recordOnce(practice)
    expect(synth.spoken.map((u) => u.text)).toEqual(['hola'])
    expect(practice.playing.value).toBe('native')

    synth.end()
    await vi.waitFor(() => expect(FakeAudio.played).toEqual(['blob:recording']))
    expect(practice.playing.value).toBe('own')
    audio[0]?.end()
    await vi.waitFor(() => expect(practice.playing.value).toBeNull())
  })

  it('skips playback when it is turned off and checks with the model', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    localStorage.setItem('opendeck-speech-models', '["base"]')
    stubMicrophone()
    stubCaches().file(ENCODER, 1)
    const synth = stubSpeech()
    stubPlayback()
    const worker = stubWorker()
    const practice = await practise({ text: '¿Dónde está la estación?', lang: 'es' }, { shadowPlayback: false })
    await practice.models.refresh()

    await recordOnce(practice)
    await vi.waitFor(() => expect(worker().last().type).toBe('transcribe'))
    expect(synth.spoken).toEqual([])
    expect(practice.checking.value).toBe(true)
    worker().reply({ type: 'result', id: worker().last().id, text: 'Dónde está la estación' })

    await vi.waitFor(() => expect(practice.result.value?.score).toBe(100))
    expect(practice.result.value?.heard).toBe('Dónde está la estación')
    expect(practice.checking.value).toBe(false)
  })

  it('checks the recording while it is still being played back', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    localStorage.setItem('opendeck-speech-models', '["base"]')
    stubMicrophone()
    stubCaches().file(ENCODER, 1)
    const synth = stubSpeech()
    stubPlayback()
    const worker = stubWorker()
    const practice = await practise({ text: 'hola', lang: 'es' })
    await practice.models.refresh()

    await recordOnce(practice)
    expect(practice.playing.value).toBe('native')
    await vi.waitFor(() => expect(worker().last().type).toBe('transcribe'))
    worker().reply({ type: 'result', id: worker().last().id, text: 'hola' })
    await vi.waitFor(() => expect(practice.result.value?.score).toBe(100))
    expect(synth.spoken.map((u) => u.text)).toEqual(['hola'])
    expect(practice.playing.value).toBe('native')
  })

  it('finds a model downloaded earlier without opening Settings', async () => {
    localStorage.setItem('opendeck-speech-models', '["small"]')
    stubCaches().file(`${modelPrefix(SMALL)}resolve/main/config.json`, 1)
    const practice = await practise({ text: 'hola', lang: 'es' })
    await vi.waitFor(() => expect(practice.models.active.value).toBe('small'))
  })

  it('leaves checking to the learner when automatic checks are off', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    localStorage.setItem('opendeck-speech-models', '["base"]')
    stubMicrophone()
    stubCaches().file(ENCODER, 1)
    stubPlayback()
    const worker = stubWorker()
    const practice = await practise({ text: 'gracias', lang: 'es' }, { shadowPlayback: false, autoCheck: false })
    await practice.models.refresh()

    await recordOnce(practice)
    expect(FakeWorker.instances).toHaveLength(0)
    const checked = practice.check()
    await vi.waitFor(() => expect(worker().last().type).toBe('transcribe'))
    worker().reply({ type: 'error', id: worker().last().id, message: 'out of memory' })
    await checked
    expect(practice.checkFailed.value).toBe(true)
    expect(practice.result.value).toBeNull()
  })

  it('starts over when the card changes', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    stubMicrophone()
    stubPlayback()
    const target = ref<PracticeTarget>({ text: 'uno', lang: 'es' })
    useProfile().prefs.value = { shadowPlayback: false }
    const practice = await mountWith(() => usePractice(target))
    await practice.record()
    practice.recorder.stop()
    expect(practice.recorder.recording.value).toBeTruthy()

    target.value = { text: 'dos', lang: 'es' }
    await nextTick()
    expect(practice.recorder.recording.value).toBeNull()
  })

  it('starts over on the next line even when it has the same text', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    stubMicrophone()
    stubPlayback()
    const target = ref<PracticeTarget>({ key: 0, text: 'sí', lang: 'es' })
    useProfile().prefs.value = { shadowPlayback: false }
    const practice = await mountWith(() => usePractice(target))
    await practice.record()
    practice.recorder.stop()
    expect(practice.recorder.recording.value).toBeTruthy()

    target.value = { key: 1, text: 'sí', lang: 'es' }
    await nextTick()
    expect(practice.recorder.recording.value).toBeNull()
    expect(practice.recorder.url.value).toBeNull()
  })

  it('keeps the recording when only the reading of the same line changes', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    stubMicrophone()
    stubPlayback()
    const target = ref<PracticeTarget>({ key: 0, text: 'sí', lang: 'es' })
    useProfile().prefs.value = { shadowPlayback: false }
    const practice = await mountWith(() => usePractice(target))
    await practice.record()
    practice.recorder.stop()

    target.value = { key: 0, text: 'sí', lang: 'es', readings: ['si'] }
    await nextTick()
    expect(practice.recorder.recording.value).toBeTruthy()
  })

  it('drops a check that finishes after moving on to a line with the same text', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    localStorage.setItem('opendeck-speech-models', '["base"]')
    stubMicrophone()
    stubCaches().file(ENCODER, 1)
    stubPlayback()
    const worker = stubWorker()
    const target = ref<PracticeTarget>({ key: 0, text: 'sí', lang: 'es' })
    useProfile().prefs.value = { shadowPlayback: false }
    const practice = await mountWith(() => usePractice(target))
    await practice.models.refresh()
    await practice.record()
    practice.recorder.stop()
    await vi.waitFor(() => expect(worker().last().type).toBe('transcribe'))

    target.value = { key: 1, text: 'sí', lang: 'es' }
    await nextTick()
    worker().reply({ type: 'result', id: worker().last().id, text: 'sí' })
    await vi.waitFor(() => expect(practice.checking.value).toBe(false))
    expect(practice.result.value).toBeNull()
  })
})

describe('SpeechDiff', () => {
  it('marks missing, changed and extra words in text, not only colour', async () => {
    const wrapper = await mountSuspended(SpeechDiff, {
      props: {
        lang: 'en',
        parts: [
          { kind: 'same', expected: 'where', heard: 'where' },
          { kind: 'missing', expected: 'is' },
          { kind: 'changed', expected: 'the', heard: 'a' },
          { kind: 'extra', heard: 'please' },
        ],
      },
    })
    expect(wrapper.attributes('lang')).toBe('en')
    expect(wrapper.text()).toContain('is(not heard)')
    expect(wrapper.text()).toContain('the(heard as a)')
    expect(wrapper.text()).toContain('+please(extra)')
  })
})

describe('PracticePanel', () => {
  it('offers the model download when a recording cannot be checked yet', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    stubMicrophone()
    stubCaches()
    stubPlayback()
    useProfile().prefs.value = { shadowPlayback: false }
    const practice = await mountWith(() => usePractice(() => ({ text: 'hola', lang: 'es' })))
    await practice.record()
    practice.recorder.stop()

    const wrapper = await mountSuspended(PracticePanel, { props: { practice } })
    expect(wrapper.text()).toContain('My recording')
    expect(wrapper.text()).toMatch(/Download speech model \(\d+\s?MB\)/)
  })

  it('says when a language cannot be checked', async () => {
    localStorage.setItem('opendeck-mic-explained', 'true')
    stubMicrophone()
    stubPlayback()
    useProfile().prefs.value = { shadowPlayback: false }
    const practice = await mountWith(() => usePractice(() => ({ text: 'سڵاو', lang: 'ckb' })))
    await practice.record()
    practice.recorder.stop()

    const wrapper = await mountSuspended(PracticePanel, { props: { practice } })
    expect(wrapper.text()).toContain("Checking isn't available for")
  })
})

describe('SpeechModels', () => {
  it('lists both models with their size and status', async () => {
    const cache = stubCaches()
    cache.file(ENCODER, 75_000_000)
    localStorage.setItem('opendeck-speech-models', '["base"]')
    const wrapper = await mountSuspended(SpeechModels)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ready'))
    expect(wrapper.text()).toContain('Standard')
    expect(wrapper.text()).toContain('More accurate')
    expect(wrapper.text()).toContain('Not downloaded')
    expect(wrapper.find('button[aria-label="Delete the Standard model"]').exists()).toBe(true)
  })
})

describe('SpeechModels download', () => {
  it('remembers on this device that the model finished downloading', async () => {
    const cache = stubCaches()
    const worker = stubWorker()
    const wrapper = await mountSuspended(SpeechModels)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Not downloaded'))
    const download = wrapper.findAll('button').find((b) => b.text().startsWith('Download speech model'))
    await download?.trigger('click')
    cache.file(ENCODER, 23_000_000)
    worker().reply({ type: 'loaded', id: worker().last().id })

    await vi.waitFor(() => expect(wrapper.text()).toContain('Ready'))
    await nextTick()
    expect(JSON.parse(localStorage.getItem('opendeck-speech-models') ?? '[]')).toEqual(['base'])
  })
})

describe('ConversationHandoff', () => {
  const deck: DeckView = {
    uri: 'at://did:plc:me/space.opendeck.deck/d1',
    cid: 'c',
    rkey: 'd1',
    author: 'did:plc:me',
    visibility: 'public',
    value: { title: 'Japanese', sourceLang: 'en', targetLang: 'ja', createdAt: '' },
  }
  const card = (rkey: string, back: string, backReading?: string): CardView => ({
    uri: `at://did:plc:me/space.opendeck.card/${rkey}`,
    cid: 'c',
    rkey,
    value: { deck: 'd1', front: rkey, back, backReading, createdAt: '' },
  })

  it('opens ChatGPT and Claude with a prefilled prompt that uses due words first', async () => {
    const progress = new Map<string, ProgressRecord>([
      [
        card('b', '猫').uri,
        {
          rkey: 'p',
          value: {
            card: card('b', '猫').uri,
            dueAt: '2000-01-01T00:00:00Z',
            stability: '1',
            difficulty: '1',
            repetitions: 1,
            lapses: 0,
            state: 'review',
            lastReviewedAt: '1999-12-31T00:00:00Z',
          },
        },
      ],
    ])
    const wrapper = await mountSuspended(ConversationHandoff, {
      props: { deck, cards: [card('a', '犬', 'いぬ'), card('b', '猫')], progress },
    })
    await wrapper.find('button').trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Open in ChatGPT'))
    const links = [...document.body.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')].map((a) => a.href)
    expect(links).toHaveLength(2)
    const [chatgpt, claude] = links.map((href) => new URL(href))
    expect(chatgpt?.origin + (chatgpt?.pathname ?? '')).toBe('https://chatgpt.com/')
    expect(claude?.origin + (claude?.pathname ?? '')).toBe('https://claude.ai/new')
    const prompt = chatgpt?.searchParams.get('q') ?? ''
    expect(prompt).toContain('Japanese')
    expect(prompt).toContain('English')
    expect(prompt).toContain('猫, 犬 (いぬ)')
  })
})
