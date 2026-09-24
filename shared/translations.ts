export const REPO = 'trueberryless/opendeck.space'
export const REPO_URL = `https://github.com/${REPO}`
export const DASHBOARD_URL = 'https://i18n.opendeck.space'
export const SOURCE_LANGUAGE = 'en'

export const CHECK_TEMPLATE = '2_translation_check.yaml'
export const FIX_TEMPLATE = '3_translation_fix.yaml'
export const INTERFACE_OPTION = 'Interface: menus, buttons and messages (ui)'

export type Fluency = 'native' | 'fluent'

export interface TranslationVerification {
  github: string
  name?: string
  fluency: Fluency
  date: string
  commit: string
  issue: number
}

export interface VerificationRegistry {
  ui: Record<string, TranslationVerification[]>
  packs: Record<string, Record<string, TranslationVerification[]>>
}

export function languageOption(code: string, englishName: string): string {
  return `${englishName} (${code})`
}

export function packOption(id: string, name: string): string {
  return `Starter pack: ${name} (${id})`
}

export function englishLanguageName(
  code: string,
  locales: readonly { code: string; englishName: string }[],
  languageNames: Record<string, string>,
): string {
  return locales.find((l) => l.code === code)?.englishName ?? languageNames[code] ?? code
}

export function issueUrl(template: string, fields: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams({ template })
  for (const [key, value] of Object.entries(fields)) if (value) params.set(key, value)
  return `${REPO_URL}/issues/new?${params.toString()}`
}

export function filePath(scope: string, language: string): string {
  return scope === 'ui' ? `i18n/${language}.json` : `app/data/starter-packs/${scope}/${language}.json`
}
