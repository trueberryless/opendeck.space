import { readFileSync } from 'node:fs'

const ROLES = new Set(['creator', 'maintainer', 'contributor', 'translator', 'designer', 'tester'])
const DID = /^did:(plc:[a-z2-7]{24}|web:[\w.:%-]+)$/

const { people } = JSON.parse(readFileSync('app/data/credits/credits.json', 'utf8')) as { people: unknown }
const problems: string[] = []
const seen = new Set<string>()

if (!Array.isArray(people)) problems.push('"people" must be a list')
for (const [i, person] of (Array.isArray(people) ? people : []).entries()) {
  const p = person as { did?: unknown; github?: unknown; roles?: unknown }
  const at = `people[${i}]`
  if (typeof p.did !== 'string' || !DID.test(p.did)) problems.push(`${at}: "did" must be a did:plc or did:web`)
  else if (seen.has(p.did)) problems.push(`${at}: ${p.did} is listed twice`)
  else seen.add(p.did)
  if (p.github !== undefined && (typeof p.github !== 'string' || !/^[\w-]+$/.test(p.github))) {
    problems.push(`${at}: "github" must be a GitHub username`)
  }
  if (!Array.isArray(p.roles)) {
    problems.push(`${at}: "roles" must be a list`)
    continue
  }
  for (const r of p.roles) {
    const role = typeof r === 'string' ? r : (r as { role?: unknown })?.role
    const note = typeof r === 'string' ? undefined : (r as { note?: unknown })?.note
    if (typeof role !== 'string' || !ROLES.has(role)) problems.push(`${at}: unknown role ${JSON.stringify(r)}`)
    if (note !== undefined && (typeof note !== 'string' || note.length > 40)) {
      problems.push(`${at}: a note must be text of at most 40 characters`)
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log('Credits are valid')
