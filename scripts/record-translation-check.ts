import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCALES } from '../app/utils/i18n.ts'
import {
  englishLanguageName,
  filePath,
  type Fluency,
  SOURCE_LANGUAGE,
  type TranslationVerification,
  type VerificationRegistry,
} from '../shared/translations.ts'

const REGISTRY = 'app/data/translation-verifications.json'
const EMPTY = /^_No response_$/

interface IssueEvent {
  issue: { number: number; body: string | null; user: { login: string; id: number } }
}

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8')) as IssueEvent
const { issue } = event
const out = process.env.RUNNER_TEMP ?? '.'
const errors: string[] = []

function fail(): never {
  writeFileSync(join(out, 'translation-check-error.md'), errors.map((e) => `- ${e}`).join('\n'))
  console.error(errors.join('\n'))
  process.exit(1)
}

function sections(body: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of body.split(/^### /m).slice(1)) {
    const [heading = '', ...rest] = part.split('\n')
    const value = rest.join('\n').trim()
    map.set(heading.trim(), EMPTY.test(value) ? '' : value)
  }
  return map
}

const fields = sections(issue.body ?? '')
const languageField = fields.get('Language') ?? ''
const scopeField = fields.get('What did you check?') ?? ''
const fluencyField = fields.get('How well do you speak it?') ?? ''
const corrections = fields.get('Corrections') ?? ''
const credit = (fields.get('Name for the credits (optional)') ?? '')
  .replace(/[\r\n<>[\]()*_`#|\\@]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 60)

const language = /\(([a-z0-9_-]+)\)\s*$/i.exec(languageField)?.[1] ?? ''
const scopes = [...new Set([...scopeField.matchAll(/\(([a-z0-9_-]+)\)/gi)].map((m) => m[1]!))]
const fluency: Fluency = fluencyField.startsWith('Native') ? 'native' : 'fluent'

if (!language) errors.push('No language was selected.')
else if (language === SOURCE_LANGUAGE) errors.push('English is the source language and does not need a check.')
if (scopes.length === 0) errors.push('Nothing was selected under "What did you check?".')
if (!fluencyField) errors.push('The fluency question was not answered.')

for (const scope of scopes) {
  if (scope === 'ui' && language && !LOCALES.some((l) => l.code === language)) {
    errors.push(`The interface is not available in \`${language}\`.`)
  } else if (scope !== 'ui' && !existsSync(`app/data/starter-packs/${scope}/pack.json`)) {
    errors.push(`There is no starter pack called \`${scope}\`.`)
  } else if (language && !existsSync(filePath(scope, language))) {
    errors.push(`\`${filePath(scope, language)}\` does not exist.`)
  }
}

if (errors.length) fail()

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8')) as VerificationRegistry
const entry: TranslationVerification = {
  github: issue.user.login,
  ...(credit ? { name: credit } : {}),
  fluency,
  date: new Date().toISOString().slice(0, 10),
  commit: process.env.GITHUB_SHA ?? '',
  issue: issue.number,
}

function record(list: TranslationVerification[] = []): TranslationVerification[] {
  return [...list.filter((e) => e.github !== entry.github), entry]
}

function sorted<T>(object: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)))
}

for (const scope of scopes) {
  if (scope === 'ui') {
    registry.ui = sorted({ ...registry.ui, [language]: record(registry.ui[language]) })
  } else {
    const pack = registry.packs[scope] ?? {}
    registry.packs = sorted({ ...registry.packs, [scope]: sorted({ ...pack, [language]: record(pack[language]) }) })
  }
}

writeFileSync(REGISTRY, `${JSON.stringify(registry, null, 2)}\n`)

const en = JSON.parse(readFileSync('i18n/en.json', 'utf8')) as {
  languages: Record<string, string>
  packs: Record<string, { name: string }>
}
const languageName = englishLanguageName(language, LOCALES, en.languages)
const scopeNames = scopes.map((s) => (s === 'ui' ? 'interface' : `${en.packs[s]?.name ?? s} pack`))
const title = `chore(i18n): record ${languageName} check by @${issue.user.login}`

const body = [
  `Records @${issue.user.login}'s ${fluency} check of the ${languageName} (\`${language}\`) translation in \`${REGISTRY}\`.`,
  '',
  ...scopes.map((s) => `- [ ] ${s === 'ui' ? 'Interface' : (en.packs[s]?.name ?? s)}: \`${filePath(s, language)}\``),
  '',
  corrections
    ? `### Corrections from the issue\n\nMake sure these are applied before merging:\n\n${corrections
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')}`
    : 'No corrections were reported.',
  '',
  `Closes #${issue.number}`,
].join('\n')

const coAuthor = `Co-authored-by: ${issue.user.login} <${issue.user.id}+${issue.user.login}@users.noreply.github.com>`
const message = `${title}\n\nChecked: ${scopeNames.join(', ')}\n\nCloses #${issue.number}\n\n${coAuthor}\n`

writeFileSync(join(out, 'translation-check-body.md'), body)
writeFileSync(join(out, 'translation-check-commit.txt'), message)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`)
console.log(title)
