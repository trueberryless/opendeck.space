import { createI18n } from 'vue-i18n'
import de from '~~/i18n/de.json'
import en from '~~/i18n/en.json'

export default defineNuxtPlugin((nuxtApp) => {
  const stored = useCookie<string>(LOCALE_COOKIE, { default: () => DEFAULT_LOCALE, sameSite: 'lax' })
  const locale = isSupportedLocale(stored.value) ? stored.value : DEFAULT_LOCALE

  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale,
    fallbackLocale: DEFAULT_LOCALE,
    missingWarn: false,
    fallbackWarn: false,
    messages: { en, de },
  })

  nuxtApp.vueApp.use(i18n)
})
