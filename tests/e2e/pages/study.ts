import type { Locator, Page } from '@playwright/test'

export class StudyPage {
  readonly progress: Locator
  readonly reveal: Locator

  constructor(readonly page: Page) {
    this.progress = page.getByText(/Session progress:\s*\d+\/\d+/)
    this.reveal = page.getByRole('button', { name: 'Reveal' })
  }

  async open(actor: string, rkey: string) {
    await this.page.goto(`/study/${actor}/${rkey}`)
    await this.reveal.waitFor()
  }

  card(front: string) {
    return this.page.getByText(front, { exact: true })
  }

  readAloud(text: string) {
    return this.page.getByRole('button', { name: `Read aloud: ${text}`, exact: true })
  }

  rating(name: 'Again' | 'Hard' | 'Good' | 'Easy') {
    return this.page.getByRole('button', { name: new RegExp(`^${name}`) })
  }

  async answer(key: '1' | '2' | '3' | '4') {
    await this.page.keyboard.press('Space')
    await this.rating('Again').waitFor()
    await this.page.keyboard.press(key)
  }
}
