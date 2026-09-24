import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { defineConfig } from '@lunariajs/core/config'
import { LOCALES } from './app/utils/i18n.ts'
import {
  englishLanguageName,
  filePath,
  REPO,
  REPO_URL,
  reviewUrl,
  SITE_URL,
  SOURCE_LANGUAGE,
  type TranslationVerification,
  verificationPath,
} from './shared/translations.ts'

const PACKS_DIR = 'app/data/starter-packs'

const en = JSON.parse(readFileSync('i18n/en.json', 'utf8')) as {
  languages: Record<string, string>
  packs: Record<string, { name: string }>
}

function checksOf(scope: string, lang: string): TranslationVerification[] {
  const path = verificationPath(scope, lang)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as TranslationVerification[]) : []
}

const packs = readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`${PACKS_DIR}/${d.name}/pack.json`))
  .map((d) => {
    const languages = readdirSync(`${PACKS_DIR}/${d.name}`)
      .filter((f) => f.endsWith('.json') && f !== 'pack.json')
      .map((f) => f.replace(/\.json$/, ''))
    return { id: d.name, name: en.packs[d.name]?.name ?? d.name, languages }
  })
  .sort((a, b) => a.id.localeCompare(b.id))

const uiCodes = new Set(LOCALES.map((l) => l.code))
const codes = [...new Set([...uiCodes, ...packs.flatMap((p) => p.languages)])].filter((c) => c !== SOURCE_LANGUAGE)
const englishName = (code: string) => englishLanguageName(code, LOCALES, en.languages)
const locales = codes.map((lang) => ({ lang, label: englishName(lang) })).sort((a, b) => a.label.localeCompare(b.label))

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function changesSince(commit: string, path: string): number {
  if (!commit) return 0
  try {
    return Number(execFileSync('git', ['rev-list', '--count', `${commit}..HEAD`, '--', path], { encoding: 'utf8' }))
  } catch {
    return 0
  }
}

function checkedBy(list: TranslationVerification[], path: string): string {
  return list
    .map((v) => {
      const who = `<a href="https://github.com/${escape(v.github)}">@${escape(v.github)}</a>`
      const name = v.name ? `${escape(v.name)} (${who})` : who
      const since = changesSince(v.commit, path)
      const stale = since ? ` <span class="od-stale">${since} change${since === 1 ? '' : 's'} since</span>` : ''
      return `${name}, <a href="${REPO_URL}/issues/${v.issue}">${escape(v.date)}</a>${stale}`
    })
    .join('<br />')
}

function interfaceCell(lang: string): string {
  if (!uiCodes.has(lang)) return '<span class="od-muted">not available</span>'
  const list = checksOf('ui', lang)
  return list.length ? `✔ ${checkedBy(list, filePath('ui', lang))}` : '<span class="od-draft">AI draft</span>'
}

function packsCell(lang: string): string {
  const available = packs.filter((p) => p.languages.includes(lang))
  if (!available.length) return '<span class="od-muted">none yet</span>'
  const checked = available.filter((p) => checksOf(p.id, lang).length > 0)
  const names = checked.map((p) => {
    const list = checksOf(p.id, lang)
    return `<li>${escape(p.name)}${list.length ? `: ${checkedBy(list, filePath(p.id, lang))}` : ''}</li>`
  })
  const count = `${checked.length} of ${available.length} checked`
  return checked.length ? `${count}<ul>${names.join('')}</ul>` : `<span class="od-draft">${count}</span>`
}

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

function verificationTable(): string {
  const rows = locales.map(
    ({ lang, label }) => `<tr>
      <th scope="row">${escape(label)} <code>${escape(lang)}</code></th>
      <td>${interfaceCell(lang)}</td>
      <td>${packsCell(lang)}</td>
      <td><a href="${escape(reviewUrl(lang))}">Review</a></td>
    </tr>`,
  )
  return `<section class="od-intro">
    <p>
      <a href="${SITE_URL}">OpenDeck</a>'s English text is written by hand. Every other language was
      <a href="${SITE_URL}/translations">drafted with AI</a> and stays a draft until a native or fluent speaker has
      checked it. The first table shows who checked what, the ones below show which files are missing or outdated
      compared with English. Starter packs don't exist in every language yet, so many of those files are simply missing.
    </p>
    <p>
      <strong>Speak one of these languages?</strong> Click <em>Review</em> to read its files string by string next to
      English, fix what sounds wrong and approve them. You'll be credited by name.
    </p>
  </section>
  <h2 id="checked"><a href="#checked">Checked by native speakers</a></h2>
  <div class="od-table-wrap">
    <table class="od-table">
      <thead><tr><th scope="col">Language</th><th scope="col">Interface</th><th scope="col">Starter packs</th><th scope="col"><span class="sr-only">Review</span></th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  </div>`
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
    description: 'Which OpenDeck translations are complete, outdated or checked by native speakers.',
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
  renderer: { slots: { beforeTitle: header, afterTitle: verificationTable } },
})
