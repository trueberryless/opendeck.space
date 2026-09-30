import { test as base, expect } from '@playwright/test'
import type { Seed } from './data'
import { AppShell } from './pages/app'
import { ImportPage } from './pages/import'
import { StudyPage } from './pages/study'
import { signInOffline } from './seed'

const LOCAL = new Set(['127.0.0.1', 'localhost'])

interface Fixtures {
  app: AppShell
  studyPage: StudyPage
  importPage: ImportPage
  signInWith: (seed: Seed) => Promise<void>
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    const waitForHydration = () =>
      page.waitForFunction(() => {
        const app = (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.()
        return app ? !app.isHydrating : true
      })
    const goto = page.goto.bind(page)
    const reload = page.reload.bind(page)
    page.goto = async (url, options) => {
      const response = await goto(url, options)
      await waitForHydration()
      return response
    }
    page.reload = async (options) => {
      const response = await reload(options)
      await waitForHydration()
      return response
    }
    await page.route(
      (url) => !LOCAL.has(url.hostname),
      (route) => route.abort(),
    )
    await use(page)
  },
  app: async ({ page }, use) => use(new AppShell(page)),
  studyPage: async ({ page }, use) => use(new StudyPage(page)),
  importPage: async ({ page }, use) => use(new ImportPage(page)),
  signInWith: async ({ page }, use) => {
    await use((seed) => signInOffline(page, seed))
  },
})

export { expect }
