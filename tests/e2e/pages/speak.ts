import type { Locator, Page } from '@playwright/test'

export class SpeakPage {
  readonly start: Locator
  readonly record: Locator
  readonly stop: Locator
  readonly next: Locator
  readonly reply: Locator
  readonly itemCount: Locator

  constructor(readonly page: Page) {
    this.start = page.getByRole('button', { name: 'Start', exact: true })
    this.record = page.getByRole('button', { name: 'Record yourself', exact: true })
    this.stop = page.getByRole('button', { name: 'Stop recording' })
    this.next = page.getByRole('button', { name: 'Next', exact: true })
    this.reply = page.getByRole('button', { name: 'Reply', exact: true })
    this.itemCount = page.getByRole('status').filter({ hasText: /sentences?$/ })
  }

  async open() {
    await this.page.goto('/speak')
    await this.start.waitFor()
  }

  source(name: 'Phrases & dialogues' | 'A deck' | 'Your own text') {
    return this.page.getByRole('button', { name, exact: true })
  }

  async choose(label: string, option: string) {
    await this.page.getByRole('combobox', { name: label }).click()
    await this.page.getByRole('option', { name: option, exact: true }).click()
  }

  async recordTake() {
    await this.record.click()
    await this.stop.click()
  }
}
