import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { LOCALES } from '../app/utils/i18n.ts'
import {
  CHECK_TEMPLATE,
  englishLanguageName,
  FIX_TEMPLATE,
  INTERFACE_OPTION,
  languageOption,
  packOption,
  SOURCE_LANGUAGE,
} from '../shared/translations.ts'

const PACKS_DIR = 'app/data/starter-packs'
const en = JSON.parse(readFileSync('i18n/en.json', 'utf8')) as {
  languages: Record<string, string>
  packs: Record<string, { name: string }>
}

const packs = readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`${PACKS_DIR}/${d.name}/pack.json`))
  .map((d) => d.name)
  .sort()

const packLanguages = packs.flatMap((pack) =>
  readdirSync(`${PACKS_DIR}/${pack}`)
    .filter((f) => f.endsWith('.json') && f !== 'pack.json')
    .map((f) => f.replace(/\.json$/, '')),
)

const languages = [...new Set([...LOCALES.map((l) => l.code), ...packLanguages])]
  .filter((code) => code !== SOURCE_LANGUAGE)
  .map((code) => languageOption(code, englishLanguageName(code, LOCALES, en.languages)))
  .sort((a, b) => a.localeCompare(b, 'en'))

const scopes = [INTERFACE_OPTION, ...packs.map((id) => packOption(id, en.packs[id]?.name ?? id))]

function yamlString(value: string): string {
  return /[:#'"{}[\],&*!|>%@`]/.test(value) ? `'${value.replaceAll("'", "''")}'` : value
}

function replaceBlock(source: string, name: string, options: string[]): string {
  const pattern = new RegExp(`( *)# sync:${name}\\n[\\s\\S]*?\\1# /sync:${name}`, 'g')
  return source.replace(pattern, (_match, indent: string) =>
    [`${indent}# sync:${name}`, ...options.map((o) => `${indent}- ${yamlString(o)}`), `${indent}# /sync:${name}`].join(
      '\n',
    ),
  )
}

const check = process.argv.includes('--check')
const stale: string[] = []

for (const template of [CHECK_TEMPLATE, FIX_TEMPLATE]) {
  const path = `.github/ISSUE_TEMPLATE/${template}`
  const current = readFileSync(path, 'utf8')
  const next = replaceBlock(replaceBlock(current, 'languages', languages), 'scopes', scopes)
  if (next === current) continue
  if (check) stale.push(path)
  else writeFileSync(path, next)
}

if (stale.length) {
  console.error(`Out of date, run \`pnpm translations:sync\`:\n${stale.join('\n')}`)
  process.exit(1)
}
console.log(check ? 'Translation issue forms are up to date' : 'Translation issue forms synced')
