import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

test.describe('discover', () => {
  test('lists the starter packs and filters them by topic', async ({ page }) => {
    await page.goto('/discover')
    const packs = page.getByRole('main').locator('a[href^="/starter/"]')
    const all = await packs.count()
    expect(all).toBeGreaterThan(10)

    const filter = page.getByRole('group', { name: 'Filter packs by topic' })
    await filter.getByRole('button', { name: 'Nature' }).click()
    await expect(filter.getByRole('button', { name: 'Nature' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => packs.count()).toBeLessThan(all)
    await expect(packs.filter({ hasText: 'Animals' })).toBeVisible()
    await expect(packs.filter({ hasText: 'Survival vocabulary' })).toHaveCount(0)

    await filter.getByRole('button', { name: 'All' }).click()
    await expect.poll(() => packs.count()).toBe(all)
  })

  test('offers a search for people to learn from', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('searchbox', { name: /search people/i })).toBeVisible()
    await expect(page.getByText('Sign in to build a feed from people you follow.')).toBeVisible()
  })
})

test.describe('starter pack', () => {
  async function choose(page: Page, label: 'I know' | 'I want to learn', language: string) {
    await page.getByRole('combobox', { name: label }).click()
    await page.getByRole('option', { name: language, exact: true }).click()
  }

  test('previews the pack in the chosen languages', async ({ page }) => {
    await page.goto('/starter/survival')
    await expect(page.getByRole('heading', { level: 1, name: 'Survival vocabulary' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'I know' })).toContainText('English')

    await choose(page, 'I want to learn', 'German')
    const preview = page.getByRole('main').getByRole('list').first()
    await expect(preview.getByRole('listitem').first()).toContainText('Hello')
    await expect(preview.getByRole('listitem').first()).toContainText('Hallo')
  })

  test('limits the pack to the easiest words with a slider', async ({ page }) => {
    await page.goto('/starter/survival')
    await expect(page.getByText(/^\d{3} terms & phrases$/)).toBeVisible()
    const slider = page.getByRole('slider', { name: 'Words to add' })
    await slider.focus()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('2 terms & phrases')).toBeVisible()
    await expect(page.getByRole('main').getByRole('list').first().getByRole('listitem')).toHaveText([
      /Hello/,
      /Goodbye/,
    ])
  })

  test('swaps the two languages', async ({ page }) => {
    await page.goto('/starter/survival')
    await choose(page, 'I want to learn', 'German')
    await page.getByRole('button', { name: 'Swap languages' }).click()
    await expect(page.getByRole('combobox', { name: 'I know' })).toContainText('German')
    await expect(page.getByRole('combobox', { name: 'I want to learn' })).toContainText('English')
    await expect(page.getByRole('main').getByRole('list').first().getByRole('listitem').first()).toContainText('Hallo')
  })

  test('asks signed out visitors to sign in before saving', async ({ page }) => {
    await page.goto('/starter/survival')
    await expect(page.getByText('Sign in to save this deck to your own account.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to my decks' })).toHaveCount(0)
  })

  test('warns about translations that nobody has checked yet', async ({ page }) => {
    await page.goto('/starter/survival')
    await expect(page.getByText(/drafted with AI/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Help check them' })).toHaveAttribute(
      'href',
      /\/translations\/review\?lang=ban&file=survival/,
    )
  })

  test('shows a message for packs that do not exist', async ({ page }) => {
    await page.goto('/starter/not-a-pack')
    await expect(page.getByText('Pack not found')).toBeVisible()
  })
})

test.describe('translations', () => {
  test('explains how the translations were made and who checked them', async ({ page }) => {
    await page.goto('/translations')
    await expect(page.getByRole('heading', { level: 1, name: 'Translations & AI' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'How the translations were made' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'GitHub' }).first()).toHaveAttribute(
      'href',
      'https://github.com/trueberryless/opendeck.space',
    )
    await expect(page.getByRole('table').first()).toBeVisible()
  })

  test('lets translators pick a language to review', async ({ page }) => {
    await page.goto('/translations/review')
    await expect(page.getByRole('heading', { level: 1, name: 'Review a translation' })).toBeVisible()
    await page.getByRole('button', { name: 'Show popup' }).click()
    await page
      .getByRole('option', { name: /Deutsch|German/ })
      .first()
      .click()
    await expect(page).toHaveURL(/lang=de/)
  })

  test('opens the review of a language directly', async ({ page }) => {
    await page.goto('/translations/review?lang=fr&file=ui')
    await expect(page.getByRole('heading', { level: 1, name: 'Review a translation' })).toBeVisible()
    await expect(page.getByText('Sending your review opens a prefilled GitHub issue', { exact: false })).toBeVisible()
  })
})
