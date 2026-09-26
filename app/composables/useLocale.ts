import { useI18n } from 'vue-i18n'

export function useLocale() {
  const { locale } = useI18n({ useScope: 'global' })
  const stored = useCookie<string>(LOCALE_COOKIE, { default: () => DEFAULT_LOCALE, sameSite: 'lax' })

  const current = computed(() => locale.value)
  const dir = computed<TextDirection>(() => localeDir(locale.value))

  async function applyLocale(code: string) {
    if (!isSupportedLocale(code)) return
    stored.value = code
    await switchLocale(code)
  }

  function setLocale(code: string) {
    if (!isSupportedLocale(code) || code === locale.value) return
    void applyLocale(code)
    if (import.meta.client && useIsLoggedIn().value) {
      useProfile()
        .save({ uiLanguage: code })
        .catch((err) => console.error('[opendeck] failed to save language', err))
    }
  }

  return { locale, current, dir, applyLocale, setLocale, locales: LOCALES }
}
