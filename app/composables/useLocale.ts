import { useI18n } from 'vue-i18n'

export function useLocale() {
  const { locale } = useI18n()
  const stored = useCookie<string>(LOCALE_COOKIE, { default: () => DEFAULT_LOCALE, sameSite: 'lax' })

  const current = computed(() => locale.value)
  const dir = computed<TextDirection>(() => localeDir(locale.value))

  function setLocale(code: string) {
    if (!isSupportedLocale(code)) return
    locale.value = code
    stored.value = code
  }

  return { locale, current, dir, setLocale, locales: LOCALES }
}
