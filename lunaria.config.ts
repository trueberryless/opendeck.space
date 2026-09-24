import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { defineConfig } from '@lunariajs/core/config'
import { LOCALES } from './app/utils/i18n.ts'
import { englishLanguageName, REPO, REPO_URL, reviewUrl, SITE_URL, SOURCE_LANGUAGE } from './shared/translations.ts'

const PACKS_DIR = 'app/data/starter-packs'

const en = JSON.parse(readFileSync('i18n/en.json', 'utf8')) as { languages: Record<string, string> }

const packs = readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`${PACKS_DIR}/${d.name}/pack.json`))
  .map((d) => ({
    id: d.name,
    languages: readdirSync(`${PACKS_DIR}/${d.name}`)
      .filter((f) => f.endsWith('.json') && f !== 'pack.json')
      .map((f) => f.replace(/\.json$/, '')),
  }))

const uiCodes = new Set(LOCALES.map((l) => l.code))
const codes = [...new Set([...uiCodes, ...packs.flatMap((p) => p.languages)])].filter((c) => c !== SOURCE_LANGUAGE)
const englishName = (code: string) => englishLanguageName(code, LOCALES, en.languages)
const locales = codes.map((lang) => ({ lang, label: englishName(lang) })).sort((a, b) => a.label.localeCompare(b.label))

const logo = readFileSync('public/opendeck.svg', 'utf8').replace('<svg ', '<svg aria-hidden="true" ')

function header(): string {
  return `<header class="od-header">
    <a href="${SITE_URL}">${logo} OpenDeck</a>
    <nav aria-label="Links">
      <a href="${reviewUrl()}">Review a translation</a>
      <a href="${SITE_URL}/translations">About translations</a>
      <a href="${REPO_URL}">GitHub</a>
    </nav>
  </header>`
}

function intro(): string {
  return `<section class="od-intro">
    <p>
      <a href="${SITE_URL}">OpenDeck</a>'s English text is written by hand. Every other language was
      <a href="${SITE_URL}/translations">drafted with AI</a> and stays a draft until a native or fluent speaker has
      checked it. The tables below show which files are missing or outdated compared with English. Starter packs don't
      exist in every language yet, so many of those files are simply missing.
    </p>
    <p>
      Speak one of these languages? <a href="${reviewUrl()}">Review a translation</a> string by string
      next to English, fix what sounds wrong and approve it. You'll be credited by name on
      <a href="${SITE_URL}/translations">opendeck.space/translations</a>.
    </p>
  </section>`
}

export default defineConfig({
  repository: { name: REPO, branch: 'main' },
  sourceLocale: { lang: SOURCE_LANGUAGE, label: 'English' },
  locales: locales as [(typeof locales)[number], ...typeof locales],
  files: [
    { include: ['i18n/en.json'], pattern: 'i18n/@lang.json', type: 'dictionary' },
    {
      include: [`${PACKS_DIR}/*/en.json`],
      pattern: `${PACKS_DIR}/@path/@lang.json`,
      type: 'dictionary',
      optionalKeys: { language: true },
    },
  ],
  tracking: { ignoredKeywords: ['lunaria-ignore', 'fix typo', 'chore(format)'] },
  dashboard: {
    title: 'OpenDeck translations',
    description: 'Which OpenDeck translations are complete, missing or outdated.',
    site: 'https://i18n.opendeck.space',
    favicon: { inline: './public/opendeck.svg' },
    customCss: ['./lunaria/dashboard.css'],
    basesToHide: [`${PACKS_DIR}/`],
    ui: {
      'statusByLocale.heading': 'Translation progress by language',
      'statusByLocale.completeLocalization': 'Every file is translated, amazing job! 🎉',
      'statusByFile.heading': 'Translation status by file',
    },
  },
  renderer: { slots: { beforeTitle: header, afterTitle: intro } },
})
