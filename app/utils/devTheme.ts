import { isRole, type Role } from '~~/shared/credits'
import { isTier, type Tier } from '~/utils/tiers'

export type DevTier = Tier | 'none' | null

export function parseDevTier(value: unknown): DevTier {
  return value === 'none' || isTier(value) ? value : null
}

export function parseDevRoles(value: unknown): Role[] | null {
  if (value === 'none') return []
  if (typeof value !== 'string') return null
  const roles = value.split(',').filter(isRole)
  return roles.length ? roles : null
}
