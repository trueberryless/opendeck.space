import { createI18n } from 'vue-i18n'
import en from '~~/i18n/en.json'

type Messages = typeof en

const catalogs = import.meta.glob<Messages>(['../../i18n/*.json', '!../../i18n/en.json'], { import: 'default' })

export default defineNuxtPlugin(async (nuxtApp) => {
  const stored = useCookie<string>(LOCALE_COOKIE, { default: () => DEFAULT_LOCALE, sameSite: 'lax' })
  const locale = isSupportedLocale(stored.value) ? stored.value : DEFAULT_LOCALE

  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    missingWarn: false,
    fallbackWarn: false,
    pluralRules: Object.fromEntries(LOCALES.map((l) => [l.code, pluralRule(l.code)])),
    messages: { en } as Record<string, Messages>,
  })

  const loading = new Map<string, Promise<void>>()
  function loadMessages(code: string): Promise<void> {
    if (code === DEFAULT_LOCALE) return Promise.resolve()
    let pending = loading.get(code)
    if (!pending) {
      const load = catalogs[`../../i18n/${code}.json`]
      pending = load ? load().then((messages) => i18n.global.setLocaleMessage(code, messages)) : Promise.resolve()
      pending.catch(() => loading.delete(code))
      loading.set(code, pending)
    }
    return pending
  }

  await loadMessages(locale).catch((err) => console.error('[opendeck] failed to load translations', err))
  i18n.global.locale.value = locale

  nuxtApp.vueApp.use(i18n)
  bindI18n(i18n.global, loadMessages)

  return { provide: { i18n: i18n.global } }
})
