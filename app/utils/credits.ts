import registry from '~/data/credits/credits.json'

export const ROLES = ['creator', 'maintainer', 'contributor', 'translator', 'designer', 'tester'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_ICONS: Record<Role, string> = {
  creator: 'i-lucide-rocket',
  maintainer: 'i-lucide-wrench',
  contributor: 'i-lucide-git-merge',
  translator: 'i-lucide-languages',
  designer: 'i-lucide-palette',
  tester: 'i-lucide-flask-conical',
}

export interface Credit {
  role: Role
  note?: string
  languages?: string[]
}

interface RegistryEntry {
  did: string
  github?: string
  roles: (Role | { role: Role; note?: string })[]
}

const checks = import.meta.glob<{ github: string }[]>('../data/verifications/**/*.json', { import: 'default' })

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

async function checkedLanguages(github: string): Promise<string[]> {
  const languages = new Set<string>()
  await Promise.all(
    Object.entries(checks).map(async ([path, load]) => {
      const code = path.match(/\/([\w-]+)\.json$/)?.[1]
      if (code && (await load()).some((c) => c.github.toLowerCase() === github.toLowerCase())) languages.add(code)
    }),
  )
  return [...languages].sort()
}

export async function creditsFor(did: string): Promise<Credit[]> {
  const entry = (registry.people as RegistryEntry[]).find((p) => p.did === did)
  if (!entry) return []
  const credits = new Map<Role, Credit>()
  for (const r of entry.roles) {
    const credit = typeof r === 'string' ? { role: r } : { role: r.role, note: r.note }
    if (isRole(credit.role)) credits.set(credit.role, credit)
  }
  if (entry.github) {
    const languages = await checkedLanguages(entry.github).catch(() => [])
    if (languages.length) credits.set('translator', { ...credits.get('translator'), role: 'translator', languages })
  }
  return [...credits.values()].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
}
