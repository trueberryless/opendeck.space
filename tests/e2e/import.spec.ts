import { GERMAN, SPANISH } from './data'
import { expect, test } from './fixtures'

test.beforeEach(async ({ signInWith }) => {
  await signInWith({ decks: [SPANISH, GERMAN] })
})

test.describe('import', () => {
  test('offers every supported source', async ({ page, importPage }) => {
    await importPage.open()
    await expect(importPage.title).toBeVisible()
    for (const name of [/^Anki/, /^Quizlet/, /^CSV/, /^OpenDeck JSON/])
      await expect(importPage.source(name).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'survival vocabulary deck' })).toHaveAttribute('href', '/discover')
  })

  test('previews a CSV file before importing', async ({ page, importPage }) => {
    await importPage.open()
    await importPage.source(/^CSV/).click()
    await importPage.uploadFile('words.csv', 'text/csv', 'front,back,hint\nhola,hello,greeting\nadiós,goodbye,\n')
    await importPage.deckTitle.fill('Words')
    await importPage.preview.click()
    await expect(page.getByText(/Importing 1 deck, 2 cards/)).toBeVisible()
    await expect(importPage.start).toBeEnabled()
  })

  test('previews pasted Quizlet text', async ({ page, importPage }) => {
    await importPage.open()
    await importPage.source(/^Quizlet/).click()
    await page.getByRole('textbox', { name: 'Pasted text' }).fill('hola\thello\nadiós\tgoodbye\ngracias\tthank you')
    await importPage.preview.click()
    await expect(page.getByText(/Importing 1 deck, 3 cards/)).toBeVisible()
  })

  test('previews an OpenDeck export', async ({ page, importPage }) => {
    const data = {
      app: 'opendeck',
      version: 2,
      exportedAt: '2026-01-01',
      decks: [
        { title: 'Exported', cards: [{ front: 'a', back: 'b' }] },
        {
          title: 'Second',
          cards: [
            { front: 'c', back: 'd' },
            { front: 'e', back: 'f' },
          ],
        },
      ],
    }
    await importPage.open()
    await importPage.source(/^OpenDeck JSON/).click()
    await importPage.uploadFile('export.json', 'application/json', JSON.stringify(data))
    await importPage.preview.click()
    await expect(page.getByText(/Importing 2 decks, 3 cards/)).toBeVisible()
  })

  test('explains when a file cannot be read', async ({ page, importPage }) => {
    await importPage.open()
    await importPage.source(/^OpenDeck JSON/).click()
    await importPage.uploadFile('broken.json', 'application/json', 'not json')
    await importPage.preview.click()
    await expect(page.getByText(/could not parse|not valid json/i).first()).toBeVisible()
  })
})

test.describe('new deck', () => {
  test('needs a title before it can be saved', async ({ page }) => {
    await page.goto('/decks/new')
    await expect(page.getByRole('heading', { level: 1, name: 'New deck' })).toBeVisible()
    const create = page.getByRole('button', { name: 'Create deck' })
    await expect(create).toBeDisabled()
    await page.getByRole('textbox', { name: 'Title' }).fill('My deck')
    await expect(create).toBeEnabled()
  })
})
