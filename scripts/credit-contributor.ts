import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CREDITS_FILE, isGithubUser, sameGithubUser, type CreditEntry, type Role } from '../shared/credits.ts'
import { resolveHandle } from './atproto-identity.ts'

const IMPLIES_CONTRIBUTOR: ReadonlySet<Role> = new Set(['creator', 'maintainer', 'contributor'])

interface PullRequestEvent {
  pull_request: { number: number; body: string | null; user: { login: string; type: string } }
}

const { pull_request: pr } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8')) as PullRequestEvent
const out = process.env.RUNNER_TEMP ?? '.'

function output(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}

function finish(summary: string, message?: string): never {
  writeFileSync(join(out, 'credits-summary.md'), summary)
  if (message) {
    writeFileSync(join(out, 'credits-commit.txt'), message)
    output('changed', 'true')
  }
  if (handle) output('notify', 'true')
  console.log(summary)
  process.exit(0)
}

const github = pr.user.login
const handle = (pr.body ?? '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .match(/^ATproto handle:[ \t]*(\S*)/im)?.[1]
  ?.replace(/[`<>]/g, '')
  .slice(0, 100)

if (pr.user.type !== 'User' || !isGithubUser(github)) finish(`@${github} is not a person, nothing to credit.`)
const identity = handle ? await resolveHandle(handle) : null

const registry = JSON.parse(readFileSync(CREDITS_FILE, 'utf8')) as { people: CreditEntry[] }
const byGithub = registry.people.find((p) => sameGithubUser(p.github, github))
const byDid = identity && registry.people.find((p) => p.did === identity.did)

if (handle && !identity) {
  finish(`\`${handle}\` is not an ATproto handle that points back to its account, so #${pr.number} credits no one.`)
}
if (byDid && byGithub && byDid !== byGithub) {
  finish(
    `@${github} is listed under ${byGithub.did}, but \`@${identity!.handle}\` is ${identity!.did}. A maintainer will look into it.`,
  )
}
if (byDid?.github && !sameGithubUser(byDid.github, github)) {
  finish(`${identity!.did} is listed as @${byDid.github}, not @${github}. A maintainer will look into it.`)
}

const entry = byDid ?? byGithub
if (!entry && !identity) finish(`#${pr.number} names no ATproto handle and @${github} is not in the credits yet.`)

const person = entry ?? { did: identity!.did }
const roles = person.roles ?? []
const credited = roles.some((r) => IMPLIES_CONTRIBUTOR.has(typeof r === 'string' ? r : r.role))
if (credited && person.github) finish(`@${github} is already credited.`)

const updated: CreditEntry = {
  did: person.did,
  github: person.github ?? github,
  roles: credited ? roles : [...roles, 'contributor'],
}
registry.people = entry ? registry.people.map((p) => (p === entry ? updated : p)) : [...registry.people, updated]
writeFileSync(CREDITS_FILE, `${JSON.stringify(registry, null, 2)}\n`)

finish(
  `Credits @${github} (${updated.did}) as a contributor for #${pr.number}.`,
  `chore(credits): credit @${github} for #${pr.number}\n`,
)
