import { GERMAN, SPANISH } from './data'
import { expect, test } from './fixtures'

test.describe('on a phone', () => {
  test('fits the landing page without horizontal scrolling', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('navigates with the bottom bar when signed in', async ({ page, signInWith }) => {
    await signInWith({ decks: [SPANISH, GERMAN] })
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'Main navigation' }).last()
    await expect(bar.getByRole('link')).toHaveText(['Home', 'Discover', 'Study', 'Together', 'Profile'])
    await bar.getByRole('link', { name: 'Study' }).click()
    await expect(page).toHaveURL(/\/study$/)
  })

  test('studies a card with taps', async ({ page, signInWith, studyPage }) => {
    await signInWith({ decks: [SPANISH] })
    await studyPage.open('me.test', 'deck1')
    await studyPage.reveal.click()
    await studyPage.rating('Easy').click()
    await expect(studyPage.progress).toContainText('1/3')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
