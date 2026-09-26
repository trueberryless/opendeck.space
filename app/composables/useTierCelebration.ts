import type { Tier } from '~/utils/tiers'

export function useTierCelebration() {
  return useState<Tier | null>('opendeck-tier-celebration', () => null)
}
