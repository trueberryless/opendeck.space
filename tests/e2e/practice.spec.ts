import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { SPANISH } from './data'
import { expect, test } from './fixtures'
import { fakeMicrophone, fakeSpeechWorker, setHeard, workerMessages } from './media'
import { fakeSpeech, spokenTexts } from './speech'

const VOICES = [
  { lang: 'es-ES', name: 'Mónica' },
  { lang: 'en-US', name: 'Samantha' },
]

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

test.beforeEach(async ({ page, signInWith }) => {
  await fakeSpeech(page, VOICES)
  await fakeMicrophone(page)
  await fakeSpeechWorker(page, 'Hola')
  await signInWith({ decks: [SPANISH] })
})

test.describe('saying a card', () => {
  test('records the learner, plays the voice and the recording, then checks it on the device', async ({
    page,
    studyPage,
  }) => {
    await studyPage.open('me.test', 'deck1')
    await page.keyboard.press('m')
    await expect(page.getByText('OpenDeck needs your microphone to record you.')).toBeVisible()
    await page.getByRole('button', { name: 'Use the microphone' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Recording…' })).toBeVisible()

    await page.getByRole('button', { name: 'Stop recording' }).click()
    await expect.poll(() => spokenTexts(page)).toEqual(['hola'])
    await expect(page.getByRole('button', { name: 'My recording' })).toBeVisible()
    await expect(studyPage.reveal).toBeVisible()

    await page.getByRole('button', { name: /^Download speech model \(102 MB\)$/ }).click()
    await page.getByRole('button', { name: 'Check what I said' }).click()
    await expect(page.getByText('Clearly understood')).toBeVisible()
    await expect(page.getByText('100% match')).toBeVisible()
    expect(await workerMessages(page)).toEqual([
      { type: 'load', model: 'base', localOnly: false, language: undefined },
      { type: 'transcribe', model: 'base', localOnly: true, language: 'es' },
    ])
  })

  test('checks each take automatically once the model is on the device', async ({ page, studyPage }) => {
    await page.goto('/settings')
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Standard' })
      .getByRole('button', { name: /^Download/ })
      .click()
    await expect(page.getByRole('listitem').filter({ hasText: 'Standard' }).getByText('Ready')).toBeVisible()

    await studyPage.open('me.test', 'deck1')
    await setHeard(page, 'ola amigo')
    await page.keyboard.press('m')
    await page.getByRole('button', { name: 'Use the microphone' }).click()
    await page.getByRole('button', { name: 'Stop recording' }).click()
    await expect(page.getByText('Try again', { exact: true })).toBeVisible()
    await expect(page.getByText('(extra)')).toBeAttached()
    await expect(page.getByText('Heard: ola amigo')).toBeVisible()
  })

  test('opens a small practice station from the card list', async ({ page }) => {
    await page.goto('/decks/me.test/deck1')
    await page.getByRole('button', { name: 'Practise saying: hola' }).click()
    const station = page.getByRole('dialog')
    await expect(station.getByText('Listen first, then record yourself saying it.')).toBeVisible()
    await station.getByRole('button', { name: 'Record yourself' }).click()
    await station.getByRole('button', { name: 'Use the microphone' }).click()
    await station.getByRole('button', { name: 'Stop recording' }).click()
    await expect(station.getByRole('button', { name: 'Voice, then me' })).toBeVisible()
  })

  test('lists the shortcuts in the help dialog', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    await page.keyboard.press('?')
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(help.getByText('Record yourself saying the card')).toBeVisible()
  })
})

test.describe('the Speak page', () => {
  test('practises phrases from a pack one after another', async ({ page, speakPage }) => {
    await speakPage.open()
    await speakPage.choose('Language', 'Spanish')
    await expect(speakPage.itemCount).toHaveText(/^\d{2,} sentences$/)
    await speakPage.start.click()
    await expect(page.getByText(/Session progress:\s*1\/\d+/)).toBeVisible()
    await speakPage.next.click()
    await expect(page.getByText(/Session progress:\s*2\/\d+/)).toBeVisible()
    expect(await spokenTexts(page)).toEqual([])
  })

  test('speaks one side of a dialogue and lets the learner answer', async ({ page, speakPage }) => {
    await speakPage.open()
    await speakPage.choose('Pack', 'Everyday conversations')
    await speakPage.choose('Language', 'Spanish')
    await expect(speakPage.itemCount).toHaveText('6 sentences')
    await speakPage.start.click()

    await expect(page.getByText('They say')).toBeVisible()
    await expect.poll(() => spokenTexts(page)).toEqual(['¡Hola! Soy Anna. ¿Cómo se llama?'])
    await speakPage.reply.click()
    await expect(page.getByText('Your turn')).toBeVisible()
    await expect(page.getByText('Mucho gusto. Me llamo Sam.', { exact: true })).toBeVisible()
    await speakPage.record.click()
    await page.getByRole('button', { name: 'Use the microphone' }).click()
    await speakPage.stop.click()
    await expect(page.getByRole('button', { name: 'My recording' })).toBeVisible()

    await speakPage.next.click()
    await expect.poll(async () => (await spokenTexts(page)).at(-1)).toBe('¿De dónde es usted?')
    const history = page.getByRole('list', { name: 'Conversation so far' }).getByRole('listitem')
    await expect(history).toHaveCount(2)
    await expect(history.first()).toContainText('Partner:')
    await expect(history.last()).toContainText('You:')
    expect(await seriousViolations(page)).toEqual([])
  })

  test('splits the learner’s own text into sentences without uploading it', async ({ page, speakPage }) => {
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    await speakPage.open()
    await speakPage.source('Your own text').click()
    await page.getByRole('textbox', { name: 'Your text' }).fill('Hola. ¿Qué tal?\nMuy bien, gracias.')
    await speakPage.choose('Language', 'Spanish')
    await expect(speakPage.itemCount).toHaveText('3 sentences')
    await speakPage.start.click()
    await expect(page.getByText('Hola.', { exact: true })).toBeVisible()
    expect(requests.filter((url) => !url.startsWith('http://127.0.0.1'))).toEqual([])
  })

  test('practises the cards of a deck', async ({ page, speakPage }) => {
    await page.goto('/decks/me.test/deck1')
    await page.getByRole('main').getByRole('link', { name: 'Speak', exact: true }).click()
    await expect(page).toHaveURL(/\/speak\?deck=deck1$/)
    await expect(speakPage.itemCount).toHaveText('3 sentences')
    await speakPage.start.click()
    await expect(page.getByText('hello', { exact: true })).toBeVisible()
  })

  test('has no serious accessibility violations', async ({ page, speakPage }) => {
    await speakPage.open()
    expect(await seriousViolations(page)).toEqual([])
    await speakPage.start.click()
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('speech models in Settings', () => {
  test('downloads, lists and deletes a model on this device', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 2, name: 'Speaking practice' })).toBeVisible()
    const standard = page.getByRole('listitem').filter({ hasText: 'Standard' })
    await expect(standard.getByText('Not downloaded')).toBeVisible()
    await expect(standard).toContainText('75 MB')

    await standard.getByRole('button', { name: 'Download speech model (102 MB)' }).click()
    await expect(standard.getByText('Ready')).toBeVisible()
    await expect(standard).toContainText('75 MB')
    const small = page.getByRole('listitem').filter({ hasText: 'More accurate' })
    await expect(small.getByRole('button', { name: 'Download speech model (250 MB)' })).toBeVisible()

    await standard.getByRole('button', { name: 'Delete the Standard model' }).click()
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete the Standard model from this device?' })
    await expect(confirm).toContainText('You can download it again at any time.')
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(standard.getByText('Not downloaded')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('practising with an AI assistant', () => {
  test('opens ChatGPT and Claude with the prompt prefilled', async ({ page }) => {
    await page.goto('/decks/me.test/deck1')
    await page.getByRole('button', { name: 'Practise conversation' }).click()
    const dialog = page.getByRole('dialog', { name: 'Practise a conversation' })
    await expect(dialog.getByText("start voice mode in the assistant's app", { exact: false })).toBeVisible()

    const chatgpt = new URL(
      (await dialog.getByRole('link', { name: 'Open in ChatGPT (new tab)' }).getAttribute('href')) ?? '',
    )
    const claude = new URL(
      (await dialog.getByRole('link', { name: 'Open in Claude (new tab)' }).getAttribute('href')) ?? '',
    )
    expect(`${chatgpt.origin}${chatgpt.pathname}`).toBe('https://chatgpt.com/')
    expect(`${claude.origin}${claude.pathname}`).toBe('https://claude.ai/new')
    const prompt = chatgpt.searchParams.get('q') ?? ''
    expect(prompt).toBe(claude.searchParams.get('q'))
    expect(prompt).toContain("Let's practise speaking English. My own language is Spanish.")
    expect(prompt).toContain('hello, goodbye, thank you')
    await expect(dialog.getByRole('link', { name: /Gemini/ })).toHaveCount(0)
    expect(await seriousViolations(page)).toEqual([])
  })
})
