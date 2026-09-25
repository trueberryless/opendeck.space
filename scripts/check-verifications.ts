import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isDid } from '../shared/credits.ts'
import { filePath, parseVerificationPath, VERIFICATIONS_DIR } from '../shared/translations.ts'

const invalid: string[] = []
const checkFiles = existsSync(VERIFICATIONS_DIR)
  ? readdirSync(VERIFICATIONS_DIR, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.json'))
  : []
for (const file of checkFiles) {
  const path = `${VERIFICATIONS_DIR}/${file.replaceAll('\\', '/')}`
  const target = parseVerificationPath(path)
  if (!target) {
    invalid.push(`${path}: expected ui/<code>.json or packs/<pack>/<code>.json`)
    continue
  }
  if (!existsSync(filePath(target.scope, target.language))) {
    invalid.push(`${path}: ${filePath(target.scope, target.language)} does not exist`)
  }
  const checks = JSON.parse(readFileSync(path, 'utf8')) as unknown
  const valid =
    Array.isArray(checks) &&
    checks.length > 0 &&
    checks.every(
      (c: Record<string, unknown>) =>
        typeof c.github === 'string' &&
        (c.did === undefined || isDid(c.did)) &&
        (c.name === undefined || typeof c.name === 'string') &&
        (c.fluency === 'native' || c.fluency === 'fluent') &&
        typeof c.date === 'string' &&
        typeof c.commit === 'string' &&
        typeof c.issue === 'number' &&
        typeof c.strings === 'object' &&
        c.strings !== null &&
        Object.values(c.strings).every((v) => typeof v === 'string'),
    )
  if (!valid) invalid.push(`${path}: expected a non-empty list of checks, see ${VERIFICATIONS_DIR}/README.md`)
}

if (invalid.length) {
  console.error(`Invalid translation checks:\n${invalid.join('\n')}`)
  process.exit(1)
}
console.log('Translation checks are valid')
