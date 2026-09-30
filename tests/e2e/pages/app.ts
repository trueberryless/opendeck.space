import type { Locator, Page } from '@playwright/test'

export class AppShell {
  readonly nav: Locator
  readonly themeToggle: Locator
  readonly main: Locator

  constructor(readonly page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Main navigation' })
    this.themeToggle = page.getByRole('button', { name: /switch to (dark|light) mode/i })
    this.main = page.getByRole('main')
  }

  navLink(name: string) {
    return this.nav.getByRole('link', { name, exact: true })
  }

  async toggleTheme() {
    await this.themeToggle.click()
  }

  async isDark() {
    return this.page.evaluate(() => document.documentElement.classList.contains('dark'))
  }

  async pressShortcut(keys: string) {
    await this.main.click({ position: { x: 1, y: 1 } })
    for (const key of keys.split(' ')) await this.page.keyboard.press(key)
  }
}
