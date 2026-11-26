import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { createFakeAnki, type FakeAnki, type FakeAnkiOptions } from '../support/anki'
import { GERMAN, SPANISH } from './data'
import { expect, test } from './fixtures'

const isAnki = (url: URL) => url.hostname === '127.0.0.1' && url.port === '8765'

async function serveAnki(page: Page, options: FakeAnkiOptions = {}): Promise<FakeAnki> {
  const fake = createFakeAnki(options)
  await page.route(isAnki, (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(fake.reply(JSON.parse(route.request().postData() ?? '{}'))),
    }),
  )
  return fake
}

test.beforeEach(async ({ signInWith }) => {
  await signInWith({ decks: [SPANISH, GERMAN] })
})

test.describe('import from Anki desktop', () => {
  test('connects, lists the decks and previews the chosen one', async ({ page, importPage }) => {
    await serveAnki(page, {
      notes: [
        { deck: 'Japanese', fields: { Front: '猫', Back: 'cat' } },
        { deck: 'Japanese', fields: { Front: '犬', Back: 'dog' } },
        { deck: 'Italian', fields: { Front: 'ciao', Back: 'hi' } },
      ],
    })
    await importPage.open()
    await importPage.source(/^Anki desktop/).click()
    await expect(page.getByRole('heading', { name: 'How to connect Anki' })).toBeVisible()
    await expect(importPage.preview).toBeDisabled()
    await page.getByRole('button', { name: 'Connect to Anki' }).click()
    await expect(page.getByText('Connected to Anki on this computer')).toBeVisible()
    await page.getByRole('checkbox', { name: 'Japanese' }).check()
    await importPage.preview.click()
    await expect(page.getByText(/Importing 1 deck, 2 cards/)).toBeVisible()
    await expect(importPage.start).toBeEnabled()
  })

  test('explains what to check when Anki cannot be reached', async ({ page, importPage }) => {
    await page.route(isAnki, (route) => route.abort())
    await importPage.open()
    await importPage.source(/^Anki desktop/).click()
    await page.getByRole('button', { name: 'Connect to Anki' }).click()
    await expect(page.getByRole('alert')).toContainText("OpenDeck can't reach Anki")
  })

  test('has no serious accessibility violations once connected', async ({ page, importPage }) => {
    await serveAnki(page, { notes: [{ deck: 'Japanese', fields: { Front: '猫', Back: 'cat' } }] })
    await importPage.open()
    await importPage.source(/^Anki desktop/).click()
    await page.getByRole('button', { name: 'Connect to Anki' }).click()
    await expect(page.getByRole('checkbox', { name: 'Japanese' })).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  })
})

test.describe('send to Anki', () => {
  test('sends a deck and skips cards Anki already has', async ({ page }) => {
    const anki = await serveAnki(page)
    await page.goto('/decks/me.test/deck1')
    await page.getByRole('button', { name: 'Send to Anki' }).click()
    const dialog = page.getByRole('dialog', { name: 'Send to Anki' })
    await dialog.getByRole('button', { name: 'Connect to Anki' }).click()
    await dialog.getByRole('button', { name: 'Send 3 cards' }).click()
    await expect(dialog.getByRole('status').filter({ hasText: 'Sent to “Spanish basics” in Anki' })).toContainText(
      'Added: 3',
    )
    expect(anki.notes.map((n) => [n.deck, n.modelName, n.fields.Front, n.fields.Hint])).toEqual([
      ['Spanish basics', 'OpenDeck', 'hola', ''],
      ['Spanish basics', 'OpenDeck', 'adiós', 'farewell'],
      ['Spanish basics', 'OpenDeck', 'gracias', ''],
    ])

    await dialog.getByRole('button', { name: 'Send 3 cards' }).click()
    await expect(dialog.getByText('Already in Anki: 3')).toBeVisible()
    expect(anki.notes).toHaveLength(3)
  })
})
