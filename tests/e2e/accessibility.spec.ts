import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { GERMAN, SPANISH } from './data'
import { expect, test } from './fixtures'

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

test.describe('accessibility of public pages', () => {
  for (const path of ['/', '/login', '/discover', '/starter/survival', '/translations', '/terms', '/privacy']) {
    test(`${path} has no serious violations`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeVisible()
      expect(await seriousViolations(page)).toEqual([])
    })
  }

  test('dark mode keeps enough contrast', async ({ page, app }) => {
    await page.goto('/')
    const before = await app.isDark()
    await app.toggleTheme()
    await expect.poll(() => app.isDark()).toBe(!before)
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('accessibility when signed in', () => {
  test.beforeEach(async ({ signInWith }) => {
    await signInWith({ decks: [SPANISH, GERMAN] })
  })

  for (const path of ['/', '/study', '/decks/me.test/deck1', '/settings', '/profile', '/import']) {
    test(`${path} has no serious violations`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeVisible()
      await page.waitForTimeout(300)
      expect(await seriousViolations(page)).toEqual([])
    })
  }

  test('the study session has no serious violations', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    await studyPage.reveal.click()
    expect(await seriousViolations(page)).toEqual([])
  })
})
