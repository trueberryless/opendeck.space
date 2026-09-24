import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { defineConfig } from '@lunariajs/core/config'
import { LOCALES } from './app/utils/i18n.ts'
import {
  CHECK_TEMPLATE,
  englishLanguageName,
  filePath,
  INTERFACE_OPTION,
  issueUrl,
  languageOption,
  packOption,
  REPO,
  REPO_URL,
  SOURCE_LANGUAGE,
  type TranslationVerification,
  type VerificationRegistry,
} from './shared/translations.ts'

const PACKS_DIR = 'app/data/starter-packs'

const en = JSON.parse(readFileSync('i18n/en.json', 'utf8')) as {
  languages: Record<string, string>
  packs: Record<string, { name: string }>
}
const registry = JSON.parse(readFileSync('app/data/translation-verifications.json', 'utf8')) as VerificationRegistry

const packs = readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`${PACKS_DIR}/${d.name}/pack.json`))
  .map((d) => {
    const manifest = JSON.parse(readFileSync(`${PACKS_DIR}/${d.name}/pack.json`, 'utf8')) as { verified?: boolean }
    const languages = readdirSync(`${PACKS_DIR}/${d.name}`)
      .filter((f) => f.endsWith('.json') && f !== 'pack.json')
      .map((f) => f.replace(/\.json$/, ''))
    return { id: d.name, name: en.packs[d.name]?.name ?? d.name, verified: manifest.verified === true, languages }
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
  const list = registry.ui[lang] ?? []
  return list.length ? `✔ ${checkedBy(list, filePath('ui', lang))}` : '<span class="od-draft">AI draft</span>'
}

function packsCell(lang: string): string {
  const available = packs.filter((p) => p.languages.includes(lang))
  if (!available.length) return '<span class="od-muted">none yet</span>'
  const checked = available.filter((p) => p.verified || (registry.packs[p.id]?.[lang]?.length ?? 0) > 0)
  const names = checked.map((p) => {
    const list = registry.packs[p.id]?.[lang] ?? []
    return `<li>${escape(p.name)}${list.length ? `: ${checkedBy(list, filePath(p.id, lang))}` : ''}</li>`
  })
  const count = `${checked.length} of ${available.length} checked`
  return checked.length ? `${count}<ul>${names.join('')}</ul>` : `<span class="od-draft">${count}</span>`
}

function verificationTable(): string {
  const rows = locales.map(({ lang, label }) => {
    const firstPack = packs.find((p) => p.languages.includes(lang))
    const scope = uiCodes.has(lang) || !firstPack ? INTERFACE_OPTION : packOption(firstPack.id, firstPack.name)
    const help = issueUrl(CHECK_TEMPLATE, { language: languageOption(lang, label), scope })
    return `<tr>
      <th scope="row">${escape(label)} <code>${escape(lang)}</code></th>
      <td>${interfaceCell(lang)}</td>
      <td>${packsCell(lang)}</td>
      <td><a href="${escape(help)}">I checked it</a></td>
    </tr>`
  })
  return `<section class="od-intro">
    <p>
      <a href="https://opendeck.space">OpenDeck</a> is a flashcard app for learning languages. Its English text is
      written by hand. The other languages, both the interface and the starter packs, were first drafted with AI
      (Claude) and are waiting for native or fluent speakers to check them.
      <a href="https://opendeck.space/translations">Why and how we use AI</a>.
    </p>
    <p>
      The tables below come from <a href="https://lunaria.dev">Lunaria</a> and show which files are
      <strong>missing</strong> or <strong>outdated</strong> compared with English. A file that is complete can still be
      an unchecked AI draft, so the first table shows which ones a native speaker has checked.
    </p>
    <p>
      Speak one of these languages? Read through its translation, then tell us with
      <a href="${escape(issueUrl(CHECK_TEMPLATE))}">a translation check</a> (you'll be credited) or report a problem
      with <a href="${escape(issueUrl('3_translation_fix.yaml'))}">a translation fix</a>. The
      <a href="${REPO_URL}/blob/main/CONTRIBUTING.md#checking-translations">contributing guide</a> explains everything.
    </p>
  </section>
  <h2 id="checked"><a href="#checked">Checked by native speakers</a></h2>
  <div class="od-table-wrap">
    <table class="od-table">
      <thead><tr><th scope="col">Language</th><th scope="col">Interface</th><th scope="col">Starter packs</th><th scope="col">Help</th></tr></thead>
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
  },
  renderer: { slots: { afterTitle: verificationTable } },
})
