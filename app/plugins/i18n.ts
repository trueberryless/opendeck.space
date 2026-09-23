import { createI18n } from 'vue-i18n'
import ar from '~~/i18n/ar.json'
import bg from '~~/i18n/bg.json'
import bn from '~~/i18n/bn.json'
import ca from '~~/i18n/ca.json'
import ckb from '~~/i18n/ckb.json'
import cs from '~~/i18n/cs.json'
import da from '~~/i18n/da.json'
import de from '~~/i18n/de.json'
import el from '~~/i18n/el.json'
import en from '~~/i18n/en.json'
import es from '~~/i18n/es.json'
import fa from '~~/i18n/fa.json'
import fi from '~~/i18n/fi.json'
import fr from '~~/i18n/fr.json'
import he from '~~/i18n/he.json'
import hi from '~~/i18n/hi.json'
import hr from '~~/i18n/hr.json'
import hu from '~~/i18n/hu.json'
import id from '~~/i18n/id.json'
import it from '~~/i18n/it.json'
import ja from '~~/i18n/ja.json'
import ko from '~~/i18n/ko.json'
import ms from '~~/i18n/ms.json'
import nl from '~~/i18n/nl.json'
import no from '~~/i18n/no.json'
import pl from '~~/i18n/pl.json'
import pt from '~~/i18n/pt.json'
import ro from '~~/i18n/ro.json'
import ru from '~~/i18n/ru.json'
import sk from '~~/i18n/sk.json'
import sr from '~~/i18n/sr.json'
import sv from '~~/i18n/sv.json'
import sw from '~~/i18n/sw.json'
import th from '~~/i18n/th.json'
import tl from '~~/i18n/tl.json'
import tr from '~~/i18n/tr.json'
import uk from '~~/i18n/uk.json'
import ur from '~~/i18n/ur.json'
import vi from '~~/i18n/vi.json'
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
    pluralRules: Object.fromEntries(LOCALES.map((l) => [l.code, pluralRule(l.code)])),
    messages: {
      en,
      ar,
      bg,
      bn,
      ca,
      ckb,
      cs,
      da,
      de,
      el,
      es,
      fa,
      fi,
      fr,
      he,
      hi,
      hr,
      hu,
      id,
      it,
      ja,
      ko,
      ms,
      nl,
      no,
      pl,
      pt,
      ro,
      ru,
      sk,
      sr,
      sv,
      sw,
      th,
      tl,
      tr,
      uk,
      ur,
      vi,
      zh,
    },
  })

  nuxtApp.vueApp.use(i18n)
  bindI18n(i18n.global)
})
