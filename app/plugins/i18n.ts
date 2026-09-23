import { createI18n } from 'vue-i18n'
import ar from '~~/i18n/ar.json'
import ckb from '~~/i18n/ckb.json'
import da from '~~/i18n/da.json'
import de from '~~/i18n/de.json'
import el from '~~/i18n/el.json'
import en from '~~/i18n/en.json'
import es from '~~/i18n/es.json'
import fr from '~~/i18n/fr.json'
import he from '~~/i18n/he.json'
import id from '~~/i18n/id.json'
import it from '~~/i18n/it.json'
import ja from '~~/i18n/ja.json'
import ko from '~~/i18n/ko.json'
import nl from '~~/i18n/nl.json'
import no from '~~/i18n/no.json'
import pl from '~~/i18n/pl.json'
import pt from '~~/i18n/pt.json'
import ru from '~~/i18n/ru.json'
import sv from '~~/i18n/sv.json'
import tr from '~~/i18n/tr.json'
import zh from '~~/i18n/zh.json'

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
    messages: { en, ar, ckb, da, de, el, es, fr, he, id, it, ja, ko, nl, no, pl, pt, ru, sv, tr, zh },
  })

  nuxtApp.vueApp.use(i18n)
  bindI18n(i18n.global)
})
