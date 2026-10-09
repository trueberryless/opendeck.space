import type { Page } from '@playwright/test'

export interface Spoken {
  lang: string
  rate: number
  text: string
  voice: string
}

export interface FakeVoice {
  lang: string
  localService?: boolean
  name: string
}

export async function fakeSpeech(page: Page, fakeVoices: FakeVoice[]) {
  await page.addInitScript((initial) => {
    const log: Spoken[] = []
    const voices = initial.map((v) => ({ default: false, localService: true, voiceURI: v.name, ...v }))

    class Utterance extends EventTarget {
      lang = ''
      rate = 1
      voice: { name: string } | null = null
      constructor(readonly text: string) {
        super()
      }
    }

    let current: Utterance | undefined
    let endTimer: ReturnType<typeof setTimeout> | undefined
    const synth = Object.assign(new EventTarget(), {
      paused: false,
      pending: false,
      speaking: false,
      getVoices: () => voices,
      speak(u: Utterance) {
        log.push({ lang: u.lang, rate: u.rate, text: u.text, voice: u.voice?.name ?? '' })
        current = u
        synth.speaking = true
        setTimeout(() => u.dispatchEvent(new Event('start')), 20)
        endTimer = setTimeout(() => {
          if (current !== u) return
          current = undefined
          synth.speaking = false
          u.dispatchEvent(new Event('end'))
        }, 600)
      },
      cancel() {
        clearTimeout(endTimer)
        const u = current
        current = undefined
        synth.speaking = false
        u?.dispatchEvent(Object.assign(new Event('error'), { error: 'canceled' }))
      },
      resume() {},
    })
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true })
    Object.defineProperty(window, '__spoken', { value: log })
  }, fakeVoices)
}

export function spoken(page: Page): Promise<Spoken[]> {
  return page.evaluate(() => (window as unknown as { __spoken: Spoken[] }).__spoken)
}

export async function spokenTexts(page: Page): Promise<string[]> {
  return (await spoken(page)).map((s) => s.text)
}
