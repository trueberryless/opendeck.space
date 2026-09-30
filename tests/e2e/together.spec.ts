import { GERMAN, SPANISH } from './data'
import { expect, test } from './fixtures'

test.beforeEach(async ({ signInWith }) => {
  await signInWith({ decks: [SPANISH, GERMAN] })
})

test.describe('together', () => {
  test('offers live battles and challenges', async ({ page }) => {
    await page.goto('/together')
    await expect(page.getByRole('heading', { level: 1, name: 'Together' })).toBeVisible()
    const battle = page.getByRole('region', { name: 'Live battle' })
    await expect(battle.getByRole('combobox', { name: 'Deck' })).toBeVisible()
    await expect(battle.getByRole('button', { name: 'Open battle room' })).toBeVisible()
    const challenges = page.getByRole('region', { name: 'Challenges' })
    await expect(challenges.getByRole('button', { name: 'New challenge' })).toBeVisible()
    await expect(challenges.getByText('No challenges yet.')).toBeVisible()
  })

  test('shows a message for a challenge that does not exist', async ({ page }) => {
    await page.goto('/together/challenges/me.test/missing')
    await expect(page.getByText('Challenge not found')).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Together' }).click()
    await expect(page).toHaveURL(/\/together$/)
  })
})

test.describe('welcome', () => {
  test('walks a new learner through three questions and can be skipped', async ({ page }) => {
    await page.goto('/welcome')
    await expect(page.getByRole('heading', { level: 1, name: 'Who should see your profile?' })).toBeVisible()
    await expect(page.getByText('Question 1 of 3')).toBeVisible()
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(page.getByText('Question 2 of 3')).toBeVisible()
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(page.getByText('Question 3 of 3')).toBeVisible()
  })
})
