import registry from '~/data/credits/credits.json'
import { isRole, ROLES, type CreditEntry, type Role } from '~~/shared/credits'
import { hasCheckedTranslations } from '~/utils/translations'

export const ROLE_ICONS: Record<Role, string> = {
  creator: 'i-lucide-rocket',
  maintainer: 'i-lucide-wrench',
  contributor: 'i-lucide-git-merge',
  translator: 'i-lucide-languages',
  designer: 'i-lucide-palette',
  tester: 'i-lucide-flask-conical',
}

const TEXT = '︎'

export const ROLE_GLYPHS: Record<Role, string[]> = {
  creator: ['✦', '✧', '★', '✶', '✷', '✺', '⋆', '✹'],
  maintainer: [`⚙${TEXT}`, `⚒${TEXT}`, '⌘', '⟳', '✚', '⇄', '⌗', '◇'],
  contributor: ['{ }', '</>', '=>', '()', '[ ]', '&&', '#', 'λ', '++', '::', '!=', '$'],
  translator: ['あ', 'Ж', 'ع', '한', 'Ω', 'ñ', 'ß', 'अ', 'ש', '文', 'ç', 'ø', 'ก', 'ψ', 'ğ', 'Ä', '語', 'é'],
  designer: ['●', '◆', '▲', '■', '◐', '○', '△', '◇', '□', '✎'],
  tester: ['✓', `✔${TEXT}`, '◉', '⚑', '✗', '⊙', '≟', `☑${TEXT}`, '☐'],
}

export interface Credit {
  role: Role
  note?: string
}

export function creditsFor(did: string): Credit[] {
  const entry = (registry.people as CreditEntry[]).find((p) => p.did === did)
  const credits = new Map<Role, Credit>()
  for (const r of entry?.roles ?? []) {
    const credit = typeof r === 'string' ? { role: r } : { role: r.role, note: r.note }
    if (isRole(credit.role)) credits.set(credit.role, credit)
  }
  if (!credits.has('translator') && hasCheckedTranslations(did, entry?.github)) {
    credits.set('translator', { role: 'translator' })
  }
  return [...credits.values()].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
}
