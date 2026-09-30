import { readFileSync } from 'node:fs'
import { CREDITS_FILE, isDid, isGithubUser, isRole, MAX_NOTE_LENGTH, sameGithubUser } from '../shared/credits.ts'

const { people } = JSON.parse(readFileSync(CREDITS_FILE, 'utf8')) as { people: unknown }
const problems: string[] = []
const dids = new Set<string>()
const githubs: string[] = []

if (!Array.isArray(people)) problems.push('"people" must be a list')
for (const [i, person] of (Array.isArray(people) ? people : []).entries()) {
  const p = person as { did?: unknown; github?: unknown; roles?: unknown }
  const at = `people[${i}]`
  if (!isDid(p.did)) problems.push(`${at}: "did" must be a did:plc or did:web`)
  else if (dids.has(p.did)) problems.push(`${at}: ${p.did} is listed twice`)
  else dids.add(p.did)
  if (p.github !== undefined) {
    if (!isGithubUser(p.github)) problems.push(`${at}: "github" must be a GitHub username`)
    else if (githubs.some((g) => sameGithubUser(g, p.github as string))) {
      problems.push(`${at}: @${p.github} belongs to two DIDs`)
    } else githubs.push(p.github)
  }
  if (p.roles !== undefined && (!Array.isArray(p.roles) || p.roles.length === 0)) {
    problems.push(`${at}: "roles" must be a list of roles, or left out`)
    continue
  }
  for (const r of (p.roles as unknown[] | undefined) ?? []) {
    const role = typeof r === 'string' ? r : (r as { role?: unknown })?.role
    const note = typeof r === 'string' ? undefined : (r as { note?: unknown })?.note
    if (!isRole(role)) problems.push(`${at}: unknown role ${JSON.stringify(r)}`)
    if (note !== undefined && (typeof note !== 'string' || !note.trim() || note.length > MAX_NOTE_LENGTH)) {
      problems.push(`${at}: a note must be text of at most ${MAX_NOTE_LENGTH} characters`)
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log('Credits are valid')
