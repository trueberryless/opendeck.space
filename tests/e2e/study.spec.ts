import { GERMAN, SPANISH } from './data'
import { expect, test } from './fixtures'

test.beforeEach(async ({ signInWith }) => {
  await signInWith({ decks: [SPANISH, GERMAN] })
})

test.describe('home', () => {
  test('greets the learner and lists their decks', async ({ page, app }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back, Test Learner' })).toBeVisible()
    await expect(app.nav.getByRole('link')).toHaveText(['Home', 'Discover', 'Study', 'Together', 'Profile'])
    const decks = page.getByRole('main').locator('a[href^="/decks/me.test/"]')
    await expect(decks).toHaveCount(2)
    await expect(decks.first()).toContainText('German verbs')
    await expect(decks.nth(1)).toContainText('Spanish basics')
  })

  test('shows the current study tier', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('main').getByText('Bronze').first()).toBeVisible()
  })

  test('keeps the decks in place while the study tier loads', async ({ page }) => {
    await page.goto('/')
    const deck = page.getByRole('link', { name: /Spanish basics/ })
    await expect(deck).toBeVisible()
    const before = (await deck.boundingBox())!.y
    await expect(page.getByRole('main').getByText('Bronze').first()).toBeVisible()
    expect((await deck.boundingBox())!.y).toBe(before)
  })

  test('opens a deck', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Spanish basics/ }).click()
    await expect(page).toHaveURL(/\/decks\/me\.test\/deck1$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Spanish basics' })).toBeVisible()
  })
})

test.describe('deck page', () => {
  test('lists the cards of the deck', async ({ page }) => {
    await page.goto('/decks/me.test/deck1')
    await expect(page.getByText('3 cards').first()).toBeVisible()
    for (const text of ['hola', 'hello', 'adiós', 'goodbye', 'gracias', 'thank you']) {
      await expect(page.getByRole('main').getByText(text, { exact: true })).toBeVisible()
    }
  })

  test('offers to study, add cards, edit, export and keep the deck offline', async ({ page }) => {
    await page.goto('/decks/me.test/deck1')
    for (const name of ['Study', 'Add card', 'Edit', 'Export', 'Keep offline']) {
      await expect(
        page
          .getByRole('main')
          .getByRole('button', { name })
          .or(page.getByRole('main').getByRole('link', { name }))
          .first(),
      ).toBeVisible()
    }
  })

  test('starts a study session from the deck', async ({ page }) => {
    await page.goto('/decks/me.test/deck1')
    await page.getByRole('main').getByRole('link', { name: 'Study' }).first().click()
    await expect(page).toHaveURL(/\/study\/me\.test\/deck1$/)
  })

  test('tells when a deck does not exist', async ({ page }) => {
    await page.goto('/decks/me.test/missing')
    await expect(page.getByText('Deck not found').first()).toBeVisible()
  })
})

test.describe('study overview', () => {
  test('shows how many cards are due in each deck', async ({ page }) => {
    await page.goto('/study')
    await expect(page.getByText('4 cards due across your decks.')).toBeVisible()
    const spanish = page
      .getByRole('main')
      .locator('li, article, div')
      .filter({ hasText: 'Spanish basics' })
      .filter({ hasText: '3 due' })
      .first()
    await expect(spanish).toBeVisible()
  })
})

test.describe('study session', () => {
  test('reveals a card and grades it with the keyboard', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    await expect(studyPage.progress).toContainText('0/3')
    await expect(page.getByText('Card 1 of 3: hola')).toBeVisible()
    await expect(studyPage.card('hello')).toHaveCount(0)

    await page.keyboard.press('Space')
    await expect(studyPage.card('hello')).toBeVisible()
    await expect(studyPage.rating('Again')).toBeVisible()
    await page.keyboard.press('4')
    await expect(studyPage.progress).toContainText('1/3')
    await expect(page.getByText('Card 2 of 3: adiós')).toBeVisible()
  })

  test('grades with the buttons and by tapping the card', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    await studyPage.reveal.click()
    await studyPage.rating('Easy').click()
    await expect(studyPage.progress).toContainText('1/3')
    await page.getByText('Tap or press space to reveal').click()
    await expect(studyPage.card('goodbye')).toBeVisible()
  })

  test('shows the hint on request', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    await studyPage.answer('4')
    await expect(page.getByText('Card 2 of 3: adiós')).toBeVisible()
    await expect(page.getByText('farewell')).toHaveCount(0)
    await page.keyboard.press('h')
    await expect(page.getByText('farewell')).toBeVisible()
  })

  test('finishes the session and saves progress on this device while offline', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    for (let i = 0; i < 3; i++) await studyPage.answer('4')
    await expect(page.getByText('Session complete!')).toBeVisible()
    await expect(page.getByText('You did 3 repetitions.')).toBeVisible()

    await page.goto('/study')
    await expect(page.getByText('1 card due across your decks.')).toBeVisible()
  })

  test('keeps progress after a reload in the middle of a session', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    await studyPage.answer('4')
    await expect(studyPage.progress).toContainText('1/3')
    await page.reload()
    await expect(page.getByText('Card 1 of 2: adiós')).toBeVisible()
  })

  test('steps back through answered cards and forward again, but never past the current card', async ({
    page,
    studyPage,
  }) => {
    await studyPage.open('me.test', 'deck1')
    const previous = page.getByRole('button', { name: 'Previous card' })
    const next = page.getByRole('button', { name: 'Next card' })
    await expect(previous).toBeDisabled()
    await expect(next).toBeDisabled()

    await studyPage.answer('4')
    await studyPage.answer('4')
    await expect(page.getByText('Card 3 of 3: gracias')).toBeVisible()
    await expect(next).toBeDisabled()

    await previous.click()
    await expect(studyPage.card('goodbye')).toBeVisible()
    await expect(studyPage.card('adiós')).toBeVisible()
    await expect(page.getByText('Easy', { exact: true })).toBeVisible()
    await expect(studyPage.reveal).toHaveCount(0)
    await expect(next).toBeEnabled()

    await page.keyboard.press('p')
    await expect(studyPage.card('hello')).toBeVisible()
    await expect(page.getByText('Easy', { exact: true })).toBeVisible()
    await expect(previous).toBeDisabled()

    await page.keyboard.press('ArrowRight')
    await expect(studyPage.card('goodbye')).toBeVisible()
    await next.click()
    await expect(page.getByText('Card 3 of 3: gracias')).toBeVisible()
    await expect(studyPage.progress).toContainText('2/3')
    await expect(next).toBeDisabled()
    await studyPage.answer('4')
    await expect(page.getByText('Session complete!')).toBeVisible()
    await previous.click()
    await expect(studyPage.card('thank you')).toBeVisible()
  })

  test('goes back to the deck with b', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    await page.keyboard.press('b')
    await expect(page).toHaveURL(/\/decks\/me\.test\/deck1$/)
  })

  test('can study the other direction', async ({ page, studyPage }) => {
    await studyPage.open('me.test', 'deck1')
    await page.getByRole('button', { name: 'Study options' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Flip direction' }).click()
    await expect(page.getByText('Card 1 of 3: hello')).toBeVisible()
  })
})

test.describe('profile', () => {
  test('summarises the learner, their tier and decks', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile\/me\.test$/)
    await expect(page.getByText('Test Learner').first()).toBeVisible()
    await expect(page.getByText('@me.test')).toBeVisible()
    await expect(page).toHaveTitle('Profile · OpenDeck')
    await expect(page.getByText('Bronze').first()).toBeVisible()
    await expect(page.getByText('Study progress')).toBeVisible()
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible()
  })
})

test.describe('settings', () => {
  test('switches the theme', async ({ page, app }) => {
    await page.goto('/settings')
    const theme = page
      .getByRole('main')
      .getByRole('radio', { name: 'Dark' })
      .or(page.getByRole('main').getByRole('button', { name: 'Dark' }))
      .first()
    await theme.click()
    await expect.poll(() => app.isDark()).toBe(true)
    await page
      .getByRole('main')
      .getByRole('radio', { name: 'Light' })
      .or(page.getByRole('main').getByRole('button', { name: 'Light' }))
      .first()
      .click()
    await expect.poll(() => app.isDark()).toBe(false)
  })

  test('changes the interface language and keeps it after a reload', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /Change language: English/ }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Deutsch' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible()
  })

  test('mirrors right to left languages', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /Change language: English/ }).click()
    await page.getByRole('menuitemcheckbox', { name: 'العربية' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })
})

test.describe('keyboard navigation when signed in', () => {
  test('jumps between the main pages', async ({ page, app }) => {
    await page.goto('/')
    await app.pressShortcut('g s')
    await expect(page).toHaveURL(/\/study$/)
    await app.pressShortcut('g p')
    await expect(page).toHaveURL(/\/profile\/me\.test$/)
    await app.pressShortcut('n')
    await expect(page).toHaveURL(/\/decks\/new$/)
  })
})
