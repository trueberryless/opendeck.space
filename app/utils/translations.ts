import {
  CHECK_TEMPLATE,
  englishLanguageName,
  FIX_TEMPLATE,
  INTERFACE_OPTION,
  issueUrl,
  languageOption,
  packOption,
  SOURCE_LANGUAGE,
  type TranslationVerification,
  type VerificationRegistry,
} from '~~/shared/translations'
import en from '~~/i18n/en.json'
import verifications from '~/data/translation-verifications.json'

export const TRANSLATION_NOTICE_KEY = 'opendeck-translation-notice-dismissed'

const registry = verifications as VerificationRegistry
const packNames = en.packs as Record<string, { name: string }>

export function uiVerifications(locale: string): TranslationVerification[] {
  return registry.ui[locale] ?? []
}

export function packVerifications(pack: string, locale: string): TranslationVerification[] {
  return registry.packs[pack]?.[locale] ?? []
}

export function isOriginalLanguage(locale: string): boolean {
  return locale === SOURCE_LANGUAGE
}

export function isUiChecked(locale: string): boolean {
  return isOriginalLanguage(locale) || uiVerifications(locale).length > 0
}

export function isPackChecked(pack: { id: string; verified: boolean }, locale: string): boolean {
  return isOriginalLanguage(locale) || pack.verified || packVerifications(pack.id, locale).length > 0
}

function scopeFields(locale: string, pack?: string) {
  return {
    language: languageOption(locale, englishLanguageName(locale, LOCALES, en.languages)),
    scope: pack ? packOption(pack, packNames[pack]?.name ?? pack) : INTERFACE_OPTION,
  }
}

export function translationCheckUrl(locale?: string, pack?: string): string {
  return issueUrl(CHECK_TEMPLATE, locale ? scopeFields(locale, pack) : {})
}

export function translationFixUrl(locale?: string, pack?: string): string {
  return issueUrl(FIX_TEMPLATE, locale ? scopeFields(locale, pack) : {})
}
