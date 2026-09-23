export interface NavItem {
  label: string
  to: string
  icon: string
  authRequired?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'nav.home', to: '/', icon: 'i-lucide-house' },
  { label: 'nav.discover', to: '/discover', icon: 'i-lucide-compass' },
  { label: 'nav.study', to: '/study', icon: 'i-lucide-graduation-cap', authRequired: true },
  { label: 'nav.profile', to: '/profile', icon: 'i-lucide-user', authRequired: true },
]

export function visibleNavItems(loggedIn: boolean): NavItem[] {
  return NAV_ITEMS.filter((i) => loggedIn || !i.authRequired)
}

export function deckPath(actor: string, rkey: string): string {
  return `/decks/${actor}/${rkey}`
}

export function studyPath(actor: string, rkey: string): string {
  return `/study/${actor}/${rkey}`
}

export function profilePath(actor: string): string {
  return `/profile/${actor}`
}
