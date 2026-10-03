import AxeBuilder from '@axe-core/playwright'
import { SPANISH } from './data'
import { expect, test } from './fixtures'
import { fakeSpeech, spoken } from './speech'

test.describe('reading cards aloud', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSpeech(page, ['es-ES', 'en-US'])
  })

  test('reads the prompt and the answer with the buttons', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH] })
    await studyPage.open('me.test', 'deck1')

    await studyPage.readAloud('hola').click()
    await expect.poll(() => spoken(page)).toEqual([{ text: 'hola', lang: 'es-ES', rate: 1 }])
    await expect(page.getByRole('button', { name: 'Stop reading aloud' })).toBeVisible()
    await expect(studyPage.reveal).toBeVisible()

    await studyPage.reveal.click()
    await studyPage.readAloud('hello').click()
    await expect.poll(async () => (await spoken(page)).at(-1)).toEqual({ text: 'hello', lang: 'en-US', rate: 1 })
  })

  test('reads the prompt with s and the answer with shift+s', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH] })
    await studyPage.open('me.test', 'deck1')

    await page.keyboard.press('s')
    await expect.poll(() => spoken(page)).toEqual([{ text: 'hola', lang: 'es-ES', rate: 1 }])
    await page.keyboard.press('Space')
    await page.keyboard.press('Shift+S')
    await expect.poll(async () => (await spoken(page)).map((s) => s.text)).toEqual(['hola', 'hello'])
  })

  test('reads cards automatically at the chosen speed', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH], prefs: { autoSpeak: 'both', speechRate: 'slow' } })
    await studyPage.open('me.test', 'deck1')
    await expect.poll(() => spoken(page)).toEqual([{ text: 'hola', lang: 'es-ES', rate: 0.7 }])

    await page.keyboard.press('Space')
    await expect.poll(async () => (await spoken(page)).map((s) => s.text)).toEqual(['hola', 'hello'])
    await page.keyboard.press('4')
    await expect.poll(async () => (await spoken(page)).map((s) => s.text)).toEqual(['hola', 'hello', 'adiós'])
  })

  test('reads cards in the deck list', async ({ page, signInWith }) => {
    await signInWith({ decks: [SPANISH] })
    await page.goto('/decks/me.test/deck1')
    await page.getByRole('button', { name: 'Read aloud: gracias' }).click()
    await expect.poll(() => spoken(page)).toEqual([{ text: 'gracias', lang: 'es-ES', rate: 1 }])
  })

  test('shows the read aloud settings', async ({ page, signInWith }) => {
    await signInWith({ decks: [SPANISH] })
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 2, name: 'Read aloud' })).toBeVisible()
    await expect(page.getByText('Read aloud automatically')).toBeVisible()
    await expect(page.getByText('Speed', { exact: true })).toBeVisible()
  })

  test('keeps the study page accessible', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH] })
    await studyPage.open('me.test', 'deck1')
    await studyPage.reveal.click()
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  })
})

test('hides the buttons when the device has no voice for the language', async ({ page, signInWith, studyPage }) => {
  await fakeSpeech(page, ['ja-JP'])
  await signInWith({ decks: [SPANISH] })
  await studyPage.open('me.test', 'deck1')
  await expect(studyPage.card('hola')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Read aloud/ })).toHaveCount(0)
})
