import type { Role } from '~~/shared/credits'
import type { Tier } from '~/utils/tiers'

export interface PageBackdrop {
  tier: Tier | null
  role: Role | null
}

export function usePageBackdrop() {
  return useState<PageBackdrop | null>('page-backdrop', () => null)
}
