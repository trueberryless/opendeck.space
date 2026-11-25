const OPTIONAL_NAV_IDS = ['discover', 'study', 'speak', 'together'] as const
export const DEFAULT_NAV_IDS: readonly OptionalNavId[] = ['discover', 'study']

export type OptionalNavId = (typeof OPTIONAL_NAV_IDS)[number]
export type NavId = OptionalNavId | 'home' | 'profile'

export interface NavItem {
  id: NavId
  label: string
  to: string
  icon: string
  authRequired?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'nav.home', to: '/', icon: 'i-lucide-house' },
  { id: 'discover', label: 'nav.discover', to: '/discover', icon: 'i-lucide-compass' },
  { id: 'study', label: 'nav.study', to: '/study', icon: 'i-lucide-graduation-cap', authRequired: true },
  { id: 'speak', label: 'nav.speak', to: '/speak', icon: 'i-lucide-mic', authRequired: true },
  { id: 'together', label: 'nav.together', to: '/together', icon: 'i-lucide-swords', authRequired: true },
  { id: 'profile', label: 'nav.profile', to: '/profile', icon: 'i-lucide-user', authRequired: true },
]

export function visibleNavItems(loggedIn: boolean, shown: readonly string[] = DEFAULT_NAV_IDS): NavItem[] {
  return NAV_ITEMS.filter((i) => {
    if (!loggedIn) return !i.authRequired
    return !isOptionalNavId(i.id) || shown.includes(i.id)
  })
}

export function isOptionalNavId(id: string): id is OptionalNavId {
  return (OPTIONAL_NAV_IDS as readonly string[]).includes(id)
}

export function toggleNavId(shown: readonly string[], id: OptionalNavId, on: boolean): OptionalNavId[] {
  const next = new Set(shown.filter(isOptionalNavId))
  if (on) next.add(id)
  else next.delete(id)
  return OPTIONAL_NAV_IDS.filter((i) => next.has(i))
}

export function isNavActive(path: string, to: string): boolean {
  return to === '/' ? path === '/' : path.startsWith(to)
}

export function deckPath(actor: string, rkey: string): string {
  return `/decks/${actor}/${rkey}`
}

export function studyPath(actor: string, rkey: string): string {
  return `/study/${actor}/${rkey}`
}

export function speakPath(rkey: string): string {
  return `/speak?deck=${encodeURIComponent(rkey)}`
}

export function profilePath(actor: string): string {
  return `/profile/${actor}`
}

export function challengePath(actor: string, rkey: string): string {
  return `/together/challenges/${actor}/${rkey}`
}

export function battlePath(actor: string, id: string, key: string): string {
  return `/together/battle/${actor}/${id}#k=${key}`
}
