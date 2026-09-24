/**
 * Turns an approved translation review issue into commits on the `translations/<lang>` branch.
 *
 * The issue carries a JSON review written by opendeck.space/translations/review: the file, the commit it was reviewed
 * at, the strings the reviewer changed and, for an approval, their fluency. `validate` checks it and writes the
 * language to `$GITHUB_OUTPUT`. `record` applies the changes without reformatting the file, records the approval in
 * `app/data/verifications`, and writes the commit message, the pull request text and a comment for the pull request.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { LOCALES } from '../app/utils/i18n.ts'
import { pluralCategories } from '../app/utils/plural.ts'
import {
  CONFIRM_HEADING,
  englishLanguageName,
  filePath,
  MAX_CHANGES,
  MAX_STRING_LENGTH,
  parseReview,
  pluralFormCount,
  REVIEW_HEADING,
  reviewUrl,
  samePlaceholders,
  SOURCE_LANGUAGE,
  sourceText,
  translatableStrings,
  type TranslationVerification,
  VERIFICATIONS_DIR,
  verificationPath,
} from '../shared/translations.ts'

const EMPTY = /^_No response_$/
const BASE = process.env.BASE_REF ?? 'origin/main'

interface IssueEvent {
  issue: { number: number; body: string | null; user: { login: string; id: number } }
}

const mode = process.argv[2]
if (mode !== 'validate' && mode !== 'record') {
  console.error('Usage: translation-review.ts validate|record')
  process.exit(2)
}

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8')) as IssueEvent
const { issue } = event
const out = process.env.RUNNER_TEMP ?? '.'
const errors: string[] = []

function output(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}

function fail(): never {
  writeFileSync(join(out, 'translation-review-error.md'), errors.map((e) => `- ${e}`).join('\n'))
  console.error(errors.join('\n'))
  process.exit(1)
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
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
const review = parseReview(fields.get(REVIEW_HEADING) ?? '')
const approved = Boolean(review?.fluency) && /^- \[x\]/im.test(fields.get(CONFIRM_HEADING) ?? '')
const notes = fields.get('Notes') ?? fields.get("What's wrong, and what should it say?") ?? ''
const credit = (fields.get('Name for the credits (optional)') ?? '')
  .replace(/[\r\n<>[\]()*_`#|\\@]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 60)

if (!review) {
  errors.push(
    `The issue has no review from ${reviewUrl()}, so there is nothing to apply automatically. Apply it by hand or ask the reporter to send it from the review page.`,
  )
  fail()
}

const { language, scope, commit } = review
const path = filePath(scope, language)
const englishPath = filePath(scope, SOURCE_LANGUAGE)
const changes = Object.entries(review.changes)

if (!/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(language)) errors.push(`\`${language}\` is not a language code.`)
else if (language === SOURCE_LANGUAGE) errors.push('English is the source language and cannot be reviewed.')
if (!/^(?:ui|[a-z0-9-]+)$/.test(scope)) errors.push(`\`${scope}\` is not a file that can be reviewed.`)
else if (scope !== 'ui' && !existsSync(`app/data/starter-packs/${scope}/pack.json`)) {
  errors.push(`There is no starter pack called \`${scope}\`.`)
} else if (!errors.length && !existsSync(path)) errors.push(`\`${path}\` does not exist.`)
if (!/^[0-9a-f]{40}$/.test(commit)) errors.push('The review does not name the commit it was made at.')
else {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, BASE], { stdio: 'ignore' })
  } catch {
    errors.push(`The review was made at \`${commit}\`, which is not on \`main\`.`)
  }
}
if (!approved && changes.length === 0) errors.push('The review neither approves the file nor changes anything.')
if (changes.length > MAX_CHANGES) errors.push(`The review changes more than ${MAX_CHANGES} strings.`)

if (errors.length) fail()

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as unknown
const english = translatableStrings(scope, readJson(englishPath))
let reviewed = new Map<string, string>()
try {
  reviewed = translatableStrings(scope, JSON.parse(git('show', `${commit}:${path}`)))
} catch {
  errors.push(`\`${path}\` did not exist at \`${commit}\`.`)
  fail()
}
const forms = scope === 'ui' ? pluralCategories(language).length : 1

for (const [key, value] of changes) {
  const source = sourceText(english, key)
  if (source === undefined) errors.push(`\`${key}\` is not in the English file.`)
  else if (!reviewed.has(key)) errors.push(`\`${key}\` was not in the file when it was reviewed.`)
  else if (!value.trim()) errors.push(`\`${key}\` is empty.`)
  else if (value.length > MAX_STRING_LENGTH) errors.push(`\`${key}\` is longer than ${MAX_STRING_LENGTH} characters.`)
  else if (!samePlaceholders(source, value)) errors.push(`\`${key}\` must keep the placeholders of the English text.`)
  else if (scope === 'ui' && pluralFormCount(value) !== 1 && pluralFormCount(value) !== forms) {
    errors.push(`\`${key}\` has ${pluralFormCount(value)} plural forms, ${language} needs 1 or ${forms}.`)
  }
}

if (errors.length) fail()

const en = readJson('i18n/en.json') as { languages: Record<string, string>; packs: Record<string, { name: string }> }
const languageName = englishLanguageName(language, LOCALES, en.languages)

if (mode === 'validate') {
  output('language', language)
  console.log(`${languageName} (${language}) ${scope}: ${changes.length} changed${approved ? ', approved' : ''}`)
  process.exit(0)
}

function locateStrings(raw: string): Map<string, [number, number]> {
  const found = new Map<string, [number, number]>()
  let i = 0
  const space = () => {
    while (/\s/.test(raw[i] ?? '')) i++
  }
  const string = (): [number, number] => {
    const start = i++
    while (raw[i] !== '"') i += raw[i] === '\\' ? 2 : 1
    return [start, ++i]
  }
  const value = (at: string) => {
    space()
    if (raw[i] === '{') {
      i++
      space()
      if (raw[i] === '}') return void i++
      for (;;) {
        space()
        const key = JSON.parse(raw.slice(...string())) as string
        space()
        i++
        value(at ? `${at}.${key}` : key)
        space()
        if (raw[i++] === '}') return
      }
    }
    if (raw[i] === '[') {
      i++
      space()
      if (raw[i] === ']') return void i++
      for (let n = 0; ; n++) {
        value(`${at}.${n}`)
        space()
        if (raw[i++] === ']') return
      }
    }
    if (raw[i] === '"') return void found.set(at, string())
    while (i < raw.length && !/[\s,}\]]/.test(raw[i]!)) i++
  }
  value('')
  return found
}

const raw = readFileSync(path, 'utf8')
const current = translatableStrings(scope, JSON.parse(raw))
const positions = locateStrings(raw)
const edits: { key: string; start: number; end: number; before: string; after: string }[] = []

for (const [key, after] of changes) {
  const now = current.get(key)
  const range = positions.get(key)
  if (now === undefined || !range) errors.push(`\`${key}\` is no longer in \`${path}\`.`)
  else if (now === after) continue
  else if (now !== reviewed.get(key)) {
    errors.push(`\`${key}\` changed after the review, from "${reviewed.get(key)}" to "${now}".`)
  } else edits.push({ key, start: range[0], end: range[1], before: now, after })
}

if (errors.length) fail()

let next = raw
for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
  next = next.slice(0, edit.start) + JSON.stringify(edit.after) + next.slice(edit.end)
}
writeFileSync(path, next)

const sectionName = (s: string) => (s === 'ui' ? 'interface' : `${en.packs[s]?.name ?? s} pack`)

function readChecks(file: string): TranslationVerification[] {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as TranslationVerification[]) : []
}

function baseChecks(file: string): TranslationVerification[] {
  try {
    return JSON.parse(git('show', `${BASE}:${file}`)) as TranslationVerification[]
  } catch {
    return []
  }
}

if (approved) {
  const entry: TranslationVerification = {
    github: issue.user.login,
    ...(credit ? { name: credit } : {}),
    fluency: review.fluency!,
    date: new Date().toISOString().slice(0, 10),
    commit,
    issue: issue.number,
  }
  const file = verificationPath(scope, language)
  const checks = readChecks(file)
  const index = checks.findIndex((c) => c.github === entry.github)
  if (index === -1) checks.push(entry)
  else if (checks[index]!.issue !== entry.issue) checks[index] = entry
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(checks, null, 2)}\n`)
}

const packDir = `${VERIFICATIONS_DIR}/packs`
const allScopes = ['ui', ...(existsSync(packDir) ? readdirSync(packDir).sort() : [])]
const pendingChecks = allScopes.flatMap((s) => {
  const file = verificationPath(s, language)
  const merged = baseChecks(file)
  return readChecks(file)
    .filter((c) => !merged.some((m) => m.github === c.github && m.issue === c.issue))
    .map((check) => ({ scope: s, check }))
})

const closes = new Set<number>([issue.number])
for (const match of git('log', `${BASE}..HEAD`, '--format=%B').matchAll(/^Closes #(\d+)$/gm))
  closes.add(Number(match[1]))
const changedFiles = git('diff', '--name-only', BASE, '--', 'i18n', 'app/data/starter-packs')
  .split('\n')
  .filter(Boolean)
if (edits.length && !changedFiles.includes(path)) changedFiles.push(path)

const title = `chore(i18n): ${languageName} translation reviews`
const body = [
  `Collects every approved review of the ${languageName} (\`${language}\`) translation, so they can be merged together. Each review is summarised in a comment below.`,
  '',
  changedFiles.length
    ? `**Changed:** ${changedFiles.map((f) => `\`${f}\``).join(', ')}`
    : '**Changed:** no translations, only checks.',
  '',
  ...(pendingChecks.length
    ? [
        '| Checked | By | Issue |',
        '| --- | --- | --- |',
        ...pendingChecks.map(
          ({ scope: s, check }) =>
            `| \`${filePath(s, language)}\` | @${check.github}${check.name ? ` (${check.name})` : ''}, ${check.fluency} | #${check.issue} |`,
        ),
        '',
      ]
    : []),
  ...[...closes].sort((a, b) => a - b).map((n) => `Closes #${n}`),
].join('\n')

const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ')
const comment = [
  approved
    ? `**@${issue.user.login}** read every string of \`${path}\` and approved it as a ${review.fluency} speaker in #${issue.number}.`
    : `**@${issue.user.login}** suggested changes to \`${path}\` in #${issue.number}.`,
  '',
  ...(edits.length
    ? [
        '| Key | English | Before | After |',
        '| --- | --- | --- | --- |',
        ...edits.map(
          (e) => `| \`${e.key}\` | ${cell(sourceText(english, e.key)!)} | ${cell(e.before)} | ${cell(e.after)} |`,
        ),
      ]
    : ['No strings changed.']),
  ...(notes ? ['', '**Notes:**', '', ...notes.split('\n').map((l) => `> ${l}`)] : []),
].join('\n')

const coAuthor = `Co-authored-by: ${issue.user.login} <${issue.user.id}+${issue.user.login}@users.noreply.github.com>`
const summary = [
  approved ? `check ${languageName} ${sectionName(scope)}` : `fix ${languageName} ${sectionName(scope)}`,
  edits.length ? `(${edits.length} ${edits.length === 1 ? 'string' : 'strings'})` : '',
]
  .filter(Boolean)
  .join(' ')
const message = `chore(i18n): ${summary} by @${issue.user.login}\n\nCloses #${issue.number}\n\n${coAuthor}\n`

writeFileSync(join(out, 'translation-review-body.md'), body)
writeFileSync(join(out, 'translation-review-comment.md'), comment)
writeFileSync(join(out, 'translation-review-commit.txt'), message)
output('title', title)
console.log(`${title}: ${edits.length} changed${approved ? ', approved' : ''}`)
