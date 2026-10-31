import { describe, expect, it, vi } from 'vitest'
import { micFailure, mixToMono, recordingType } from '~/utils/recording'
import {
  cachedBytes,
  downloadMegabytes,
  formatMegabytes,
  modelPrefix,
  modelStatus,
  pickModel,
  progressFraction,
  RUNTIME_MEGABYTES,
  scoreLevel,
  speechModel,
  SPEECH_MODELS,
  trackProgress,
  whisperLanguage,
} from '~/utils/speechModels'
import { createSpeechWorker, type LoadTranscriber, type WorkerResponse } from '~/utils/speechWorker'

const [BASE, SMALL] = SPEECH_MODELS

describe('speech models', () => {
  it('loads Whisper base and small from the onnx-community repositories', () => {
    expect(SPEECH_MODELS.map((m) => m.repo)).toEqual(['onnx-community/whisper-base', 'onnx-community/whisper-small'])
    expect(speechModel('small')).toBe(SMALL)
    expect(speechModel('large')).toBeUndefined()
    expect(modelPrefix(BASE)).toBe('https://huggingface.co/onnx-community/whisper-base/')
  })

  it('maps deck languages to the languages Whisper knows', () => {
    expect(whisperLanguage('ja-JP')).toBe('ja')
    expect(whisperLanguage('zh-Hant')).toBe('zh')
    expect(whisperLanguage('nb')).toBe('no')
    expect(whisperLanguage('fil')).toBe('tl')
    expect(whisperLanguage('jv')).toBe('jw')
    expect(whisperLanguage('iw')).toBe('he')
    expect(whisperLanguage('ckb')).toBeUndefined()
    expect(whisperLanguage(undefined)).toBeUndefined()
  })

  it('adds up download progress across files against the expected size', () => {
    let files = trackProgress({}, 'onnx/encoder_model_quantized.onnx', 10, 20)
    files = trackProgress(files, 'onnx/decoder_model_merged_quantized.onnx', 30, 80)
    expect(progressFraction(files, 200)).toBe(0.2)
    expect(progressFraction(files, 50)).toBe(0.4)
    expect(progressFraction(trackProgress(files, 'config.json', 5, 0), 0)).toBeCloseTo(0.45)
    expect(progressFraction({}, 0)).toBe(0)
    expect(trackProgress({}, 'a', 30, 20).a).toEqual({ loaded: 20, total: 20 })
  })

  it('counts a model as ready only when it finished downloading and its files are still cached', () => {
    const entries = [
      { url: `${modelPrefix(BASE)}resolve/main/onnx/encoder_model_quantized.onnx`, size: 23_000_000 },
      { url: `${modelPrefix(BASE)}resolve/main/config.json`, size: 2000 },
      { url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0/dist/ort.wasm', size: 27_000_000 },
    ]
    expect(modelStatus(BASE, entries, ['base'])).toBe('ready')
    expect(modelStatus(BASE, entries, [])).toBe('missing')
    expect(modelStatus(SMALL, entries, ['small'])).toBe('missing')
    expect(cachedBytes(entries, modelPrefix(BASE))).toBe(23_002_000)
    expect(cachedBytes(entries, modelPrefix(SMALL))).toBe(0)
  })

  it('includes the speech runtime in the first download', () => {
    expect(downloadMegabytes(BASE, false)).toBe(BASE.megabytes + RUNTIME_MEGABYTES)
    expect(downloadMegabytes(SMALL, true)).toBe(SMALL.megabytes)
  })

  it('formats sizes in the interface language', () => {
    expect(formatMegabytes(102.4, 'en')).toBe('102 MB')
    expect(formatMegabytes(1250, 'de')).toBe('1.250 MB')
  })

  it('turns a score into a verdict', () => {
    expect([100, 85, 84, 60, 59, 0].map(scoreLevel)).toEqual(['great', 'great', 'close', 'close', 'again', 'again'])
  })

  it('uses the chosen model, or else the most accurate one on the device', () => {
    expect(pickModel(['base', 'small'], 'base')).toBe('base')
    expect(pickModel(['base', 'small'], undefined)).toBe('small')
    expect(pickModel(['base'], 'small')).toBe('base')
    expect(pickModel([], 'base')).toBeUndefined()
  })
})

describe('recording helpers', () => {
  it('picks the first audio format the browser can record', () => {
    expect(recordingType((t) => t === 'audio/mp4')).toBe('audio/mp4')
    expect(recordingType(() => false)).toBeUndefined()
    expect(
      recordingType(() => {
        throw new Error('no')
      }),
    ).toBeUndefined()
  })

  it('mixes stereo recordings down to mono', () => {
    expect(mixToMono([])).toEqual(new Float32Array())
    const mono = new Float32Array([0.5, -0.5])
    expect(mixToMono([mono])).toBe(mono)
    expect(Array.from(mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5])
  })

  it('tells a refused microphone from a missing one', () => {
    expect(micFailure(new DOMException('no', 'NotAllowedError'))).toBe('denied')
    expect(micFailure(new DOMException('no', 'NotFoundError'))).toBe('unavailable')
    expect(micFailure(new Error('weird'))).toBe('unsupported')
    expect(micFailure('nope')).toBe('unsupported')
  })
})

describe('createSpeechWorker', () => {
  function setup(load: LoadTranscriber) {
    const posted: WorkerResponse[] = []
    return { handle: createSpeechWorker(load, (m) => posted.push(m)), posted }
  }

  it('reports download progress, then loads each model once', async () => {
    const transcribe = vi.fn(async () => '  hola  ')
    const load = vi.fn<LoadTranscriber>(async (_model, _localOnly, onProgress) => {
      onProgress({ status: 'initiate', file: 'config.json' })
      onProgress({ status: 'progress', file: 'onnx/encoder.onnx', loaded: 5, total: 10 })
      onProgress({ status: 'progress' })
      onProgress({ status: 'progress', file: 'tokenizer.json' })
      return transcribe
    })
    const { handle, posted } = setup(load)

    await handle({ type: 'load', id: 1, model: 'base', localOnly: false })
    await handle({
      type: 'transcribe',
      id: 2,
      model: 'base',
      audio: new Float32Array(4),
      language: 'es',
      localOnly: true,
    })

    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0]?.[0]).toBe(BASE)
    expect(transcribe).toHaveBeenCalledWith(new Float32Array(4), 'es')
    expect(posted).toEqual([
      { type: 'progress', id: 1, file: 'onnx/encoder.onnx', loaded: 5, total: 10 },
      { type: 'progress', id: 1, file: 'tokenizer.json', loaded: 0, total: 0 },
      { type: 'loaded', id: 1 },
      { type: 'result', id: 2, text: 'hola' },
    ])
  })

  it('reports errors and retries a model that failed to load', async () => {
    const load = vi
      .fn<LoadTranscriber>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(async () => {
        throw 'decoder crashed'
      })
    const { handle, posted } = setup(load)

    await handle({ type: 'load', id: 1, model: 'small', localOnly: false })
    await handle({ type: 'transcribe', id: 2, model: 'small', audio: new Float32Array(), localOnly: false })
    await handle({ type: 'load', id: 3, model: 'huge' as 'base', localOnly: false })

    expect(load).toHaveBeenCalledTimes(2)
    expect(posted).toEqual([
      { type: 'error', id: 1, message: 'offline' },
      { type: 'error', id: 2, message: 'decoder crashed' },
      { type: 'error', id: 3, message: 'Unknown speech model: huge' },
    ])
  })
})
