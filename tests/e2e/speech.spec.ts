import AxeBuilder from '@axe-core/playwright'
import { SPANISH } from './data'
import { expect, test } from './fixtures'
import { fakeSpeech, spoken, spokenTexts } from './speech'

const VOICES = [
  { lang: 'es-ES', name: 'Eddy (Spanish (Spain))' },
  { lang: 'es-ES', name: 'Mónica' },
  { lang: 'es-ES', name: 'Jorge' },
  { lang: 'es-ES', name: 'Google español', localService: false },
  { lang: 'en-US', name: 'Samantha' },
]

test.describe('reading cards aloud', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSpeech(page, VOICES)
  })

  test('reads the prompt and the answer with natural voices', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH] })
    await studyPage.open('me.test', 'deck1')

    await studyPage.readAloud('hola').click()
    await expect.poll(() => spoken(page)).toEqual([{ text: 'hola', lang: 'es-ES', rate: 1, voice: 'Mónica' }])
    await expect(page.getByRole('button', { name: 'Stop reading aloud' })).toBeVisible()
    await expect(studyPage.reveal).toBeVisible()
    await expect(studyPage.readAloud('hola')).toBeVisible()

    await studyPage.reveal.click()
    await studyPage.readAloud('hello').click()
    await expect
      .poll(async () => (await spoken(page)).at(-1))
      .toEqual({ text: 'hello', lang: 'en-US', rate: 1, voice: 'Samantha' })
  })

  test('reads only the last of several quick clicks', async ({ page, signInWith }) => {
    await signInWith({ decks: [SPANISH] })
    await page.goto('/decks/me.test/deck1')
    await page.getByRole('button', { name: 'Read aloud: hola' }).click()
    await page.getByRole('button', { name: 'Read aloud: adiós' }).click()
    await page.getByRole('button', { name: 'Read aloud: gracias' }).click()
    await expect.poll(async () => (await spokenTexts(page)).at(-1)).toBe('gracias')
    await expect(page.getByRole('button', { name: 'Stop reading aloud' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Read aloud: hola' })).toBeVisible()
  })

  test('reads the prompt with s and the answer with shift+s', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH] })
    await studyPage.open('me.test', 'deck1')

    await page.keyboard.press('s')
    await expect.poll(() => spokenTexts(page)).toEqual(['hola'])
    await page.keyboard.press('Space')
    await page.keyboard.press('Shift+S')
    await expect.poll(() => spokenTexts(page)).toEqual(['hola', 'hello'])
  })

  test('reads cards automatically at the chosen speed', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH], prefs: { autoSpeak: 'both', speechRate: 'slow' } })
    await studyPage.open('me.test', 'deck1')
    await expect.poll(() => spoken(page)).toEqual([{ text: 'hola', lang: 'es-ES', rate: 0.7, voice: 'Mónica' }])

    await page.keyboard.press('Space')
    await expect.poll(() => spokenTexts(page)).toEqual(['hola', 'hello'])
    await page.keyboard.press('4')
    await expect.poll(() => spokenTexts(page)).toEqual(['hola', 'hello', 'adiós'])
  })

  test('lets the learner pick and test a voice for each deck language', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH] })
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 2, name: 'Read aloud' })).toBeVisible()
    await expect(page.getByText('Read aloud automatically')).toBeVisible()
    await expect(page.getByText('Speed', { exact: true })).toBeVisible()

    await page.getByRole('combobox', { name: 'Spanish' }).click()
    await expect(page.getByRole('option', { name: 'Google español (online)' })).toHaveCount(0)
    await page.getByRole('option', { name: 'Jorge' }).click()
    await page.getByRole('button', { name: 'Test the Spanish voice' }).click()
    await expect.poll(async () => (await spoken(page)).at(-1)).toMatchObject({ text: 'español', voice: 'Jorge' })

    await studyPage.open('me.test', 'deck1')
    await studyPage.readAloud('hola').click()
    await expect.poll(async () => (await spoken(page)).at(-1)).toMatchObject({ text: 'hola', voice: 'Jorge' })
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
  await fakeSpeech(page, [{ lang: 'ja-JP', name: 'Kyoko' }])
  await signInWith({ decks: [SPANISH] })
  await studyPage.open('me.test', 'deck1')
  await expect(studyPage.card('hola')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Read aloud/ })).toHaveCount(0)

  await page.goto('/settings')
  await expect(page.getByText('This device has no voice for Spanish')).toBeVisible()
})
