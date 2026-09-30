import { expect, test } from './fixtures'

test.describe('landing page', () => {
  test('introduces OpenDeck to signed out visitors', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: /learn languages with flashcards you keep/i }),
    ).toBeVisible()
    await expect(page).toHaveTitle(/OpenDeck/)
    await expect(page.getByRole('heading', { level: 3 })).toHaveText([
      'You own everything',
      'Spaced repetition',
      'Bring your decks',
      'Study anywhere',
    ])
  })

  test('sends visitors to sign in or to the starter decks', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('main').getByRole('link', { name: 'Get started' }).first().click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goBack()
    await page.getByRole('link', { name: 'Starter decks' }).click()
    await expect(page).toHaveURL(/\/discover$/)
  })
})

test.describe('navigation', () => {
  test('shows only public pages to signed out visitors', async ({ page, app }) => {
    await page.goto('/')
    await expect(app.nav.getByRole('link')).toHaveText(['Home', 'Discover', 'Sign in'])
  })

  test('links to the legal pages from the footer', async ({ page }) => {
    await page.goto('/')
    const footer = page.getByRole('navigation', { name: 'Legal' })
    await footer.getByRole('link', { name: 'Terms' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /terms/i })).toBeVisible()
    await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Privacy' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /privacy/i })).toBeVisible()
    await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Translations & AI' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Translations & AI' })).toBeVisible()
  })

  test('shows a friendly page for unknown addresses', async ({ page }) => {
    const response = await page.goto('/does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible()
    await page.getByRole('link', { name: 'Go back home' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('keeps signed out visitors out of private pages and remembers where they wanted to go', async ({ page }) => {
    for (const path of ['/study', '/settings', '/import', '/together', '/decks/new']) {
      await page.goto(path)
      await expect(page).toHaveURL(`http://127.0.0.1:3100/login?redirect=${path}`)
    }
  })
})

test.describe('sign in', () => {
  test('needs a handle before it can continue', async ({ page }) => {
    await page.goto('/login')
    const button = page.getByRole('button', { name: 'Continue' })
    await expect(button).toBeDisabled()
    await page.getByRole('textbox', { name: 'Handle or PDS' }).fill('alice.bsky.social')
    await expect(button).toBeEnabled()
  })

  test('explains when sign in cannot be started', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Handle or PDS' }).fill('alice.bsky.social')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText(/could not start sign-in/i)).toBeVisible()
  })

  test('links to the terms and the privacy policy', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: 'Terms', exact: true }).first()).toHaveAttribute('href', '/terms')
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
  })
})

test.describe('appearance', () => {
  test('switches between light and dark mode and remembers the choice', async ({ page, app }) => {
    await page.goto('/')
    const before = await app.isDark()
    await app.toggleTheme()
    await expect.poll(() => app.isDark()).toBe(!before)
    await page.reload()
    await expect.poll(() => app.isDark()).toBe(!before)
  })
})

test.describe('keyboard shortcuts', () => {
  test('lists the shortcuts in a dialog opened with ?', async ({ page, app }) => {
    await page.goto('/')
    await app.pressShortcut('?')
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Go to Discover')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('navigates with key sequences', async ({ page, app }) => {
    await page.goto('/')
    await app.pressShortcut('g d')
    await expect(page).toHaveURL(/\/discover$/)
    await app.pressShortcut('g h')
    await expect(page).toHaveURL(/\/$/)
  })

  test('toggles the theme with t', async ({ page, app }) => {
    await page.goto('/')
    const before = await app.isDark()
    await app.pressShortcut('t')
    await expect.poll(() => app.isDark()).toBe(!before)
  })
})

test.describe('web app basics', () => {
  test('serves the oauth client metadata for the current origin', async ({ request, baseURL }) => {
    const res = await request.get('/oauth-client-metadata.json')
    expect(res.ok()).toBe(true)
    const metadata = await res.json()
    expect(metadata).toMatchObject({ client_name: 'OpenDeck', redirect_uris: [`${baseURL}/`] })
    expect(metadata.scope).toContain('repo:space.opendeck.deck')
    expect(metadata.scope).toContain('blob:image/*')
  })

  test('is installable', async ({ page, request }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    const manifest = await (await request.get(href!)).json()
    expect(manifest).toMatchObject({ name: 'OpenDeck', display: 'standalone', start_url: '/', scope: '/' })
    expect(manifest.icons.length).toBeGreaterThan(2)
  })

  test('ships a prerendered offline app shell', async ({ request }) => {
    const res = await request.get('/app-shell')
    expect(res.ok()).toBe(true)
    expect(await res.text()).toContain('<html')
  })

  test('sets the document language and direction', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })
})
