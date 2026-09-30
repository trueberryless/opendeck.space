import type { Locator, Page } from '@playwright/test'

export class ImportPage {
  readonly title: Locator
  readonly deckTitle: Locator
  readonly start: Locator
  readonly preview: Locator

  constructor(readonly page: Page) {
    this.title = page.getByRole('heading', { name: 'Import', level: 1 })
    this.deckTitle = page.getByLabel('Deck title')
    this.start = page.getByRole('button', { name: 'Start import' })
    this.preview = page.getByRole('button', { name: 'Preview' })
  }

  async open() {
    await this.page.goto('/import')
  }

  source(name: RegExp | string) {
    return this.page.getByRole('button', { name })
  }

  async uploadFile(name: string, mimeType: string, content: string | Buffer) {
    await this.page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer: Buffer.from(content) })
  }
}
