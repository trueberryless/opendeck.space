import { readdirSync, readFileSync } from 'node:fs'
import { pluralCategories } from '../app/utils/plural.ts'

type Messages = { [key: string]: string | Messages }

function flatten(messages: Messages, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.set(path, value)
    else for (const [k, v] of flatten(value, path)) out.set(k, v)
  }
  return out
}

const load = (locale: string) => flatten(JSON.parse(readFileSync(`i18n/${locale}.json`, 'utf8')) as Messages)
const reference = load('en')
const problems: string[] = []

for (const file of readdirSync('i18n').sort()) {
  const locale = file.replace(/\.json$/, '')
  const messages = load(locale)
  const categories = pluralCategories(locale)

  for (const key of reference.keys()) if (!messages.has(key)) problems.push(`${locale}: missing ${key}`)
  for (const key of messages.keys()) if (!reference.has(key)) problems.push(`${locale}: unknown ${key}`)

  for (const [key, message] of messages) {
    const forms = message.split('|').length
    if (forms !== 1 && forms !== categories.length) {
      problems.push(
        `${locale}: ${key} has ${forms} forms, expected 1 or ${categories.length} (${categories.join(', ')})`,
      )
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log('i18n messages are consistent')
