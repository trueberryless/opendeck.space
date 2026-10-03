import type { Page } from '@playwright/test'

export interface Spoken {
  lang: string
  rate: number
  text: string
}

export async function fakeSpeech(page: Page, langs: string[]) {
  await page.addInitScript((voiceLangs) => {
    const spoken: Spoken[] = []
    const voices = voiceLangs.map((lang) => ({
      default: false,
      lang,
      localService: true,
      name: `${lang} voice`,
      voiceURI: lang,
    }))

    class Utterance extends EventTarget {
      lang = ''
      rate = 1
      voice: unknown = null
      constructor(readonly text: string) {
        super()
      }
    }

    const synth = Object.assign(new EventTarget(), {
      getVoices: () => voices,
      speak: (u: Utterance) => spoken.push({ lang: u.lang, rate: u.rate, text: u.text }),
      cancel: () => {},
    })
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true })
    Object.defineProperty(window, '__spoken', { value: spoken })
  }, langs)
}

export function spoken(page: Page): Promise<Spoken[]> {
  return page.evaluate(() => (window as unknown as { __spoken: Spoken[] }).__spoken)
}
