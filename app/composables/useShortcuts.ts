import type { MaybeRefOrGetter } from 'vue'

export interface Shortcut {
  keys: string[]
  label: string
  run?: (event: KeyboardEvent) => void
  when?: () => boolean
  onInteractive?: boolean
}

interface ShortcutGroup {
  id: string
  title: MaybeRefOrGetter<string>
  shortcuts: MaybeRefOrGetter<Shortcut[]>
}

const SEQUENCE_TIMEOUT = 1000
const ACTIVATION_KEYS = new Set(['space', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'home', 'end'])
const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
const INTERACTIVE_SELECTOR =
  'a[href], button, summary, audio, video, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="slider"], [role="menuitem"], [role="option"], [role="combobox"], [tabindex]:not([tabindex="-1"])'

const groups = shallowRef<ShortcutGroup[]>([])

export function useShortcutsEnabled() {
  return useLocalStorage('opendeck-single-key-shortcuts', true)
}

export function useShortcutHelp() {
  return useState('opendeck-shortcut-help', () => false)
}

export function useShortcuts(id: string, title: MaybeRefOrGetter<string>, shortcuts: MaybeRefOrGetter<Shortcut[]>) {
  const group: ShortcutGroup = { id, title, shortcuts }
  onMounted(() => {
    groups.value = [...groups.value.filter((g) => g.id !== id), group]
  })
  onBeforeUnmount(() => {
    groups.value = groups.value.filter((g) => g !== group)
  })
}

export function useShortcutGroups() {
  return computed(() =>
    groups.value
      .map((g) => ({
        id: g.id,
        title: toValue(g.title),
        shortcuts: toValue(g.shortcuts).filter((s) => !s.when || s.when()),
      }))
      .filter((g) => g.shortcuts.length > 0),
  )
}

export function isSingleKey(token: string): boolean {
  return !token.startsWith('mod+') && (token.length === 1 || token === 'space' || token.startsWith('shift+'))
}

function eventToken(event: KeyboardEvent): string | null {
  if (event.altKey || !event.key) return null
  const key = event.key === ' ' ? 'space' : event.key.toLowerCase()
  if (['shift', 'control', 'meta', 'alt', 'dead', 'unidentified', 'process'].includes(key)) return null
  if (event.ctrlKey || event.metaKey) return `mod+${key}`
  if (event.shiftKey && /^[a-z]$/.test(key)) return `shift+${key}`
  return key
}

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type)
  }
  return false
}

function overlayOpen(): boolean {
  return Array.from(document.querySelectorAll(OVERLAY_SELECTOR)).some(
    (el) => el instanceof HTMLElement && el.offsetParent !== null,
  )
}

export function useShortcutDispatcher() {
  const enabled = useShortcutsEnabled()
  let pending: { token: string; at: number } | null = null

  function active(): Shortcut[] {
    return groups.value
      .toReversed()
      .flatMap((g) => toValue(g.shortcuts))
      .filter((s) => s.run && (!s.when || s.when()))
  }

  function allowed(sequence: string): boolean {
    return enabled.value || !sequence.split(' ').some(isSingleKey)
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.repeat) return
    const token = eventToken(event)
    if (!token) return
    const target = event.target instanceof Element ? event.target : null
    if (isEditable(target) || overlayOpen()) {
      pending = null
      return
    }

    const shortcuts = active()
    const now = Date.now()
    const candidates = pending && now - pending.at < SEQUENCE_TIMEOUT ? [`${pending.token} ${token}`, token] : [token]
    pending = null

    for (const sequence of candidates) {
      if (!allowed(sequence)) continue
      const match = shortcuts.find((s) => s.keys.includes(sequence))
      if (!match) continue
      const lastKey = sequence.split(' ').at(-1)!
      if (ACTIVATION_KEYS.has(lastKey) && !match.onInteractive && target?.closest(INTERACTIVE_SELECTOR)) return
      event.preventDefault()
      match.run!(event)
      return
    }

    if (allowed(token) && shortcuts.some((s) => s.keys.some((k) => k.startsWith(`${token} `)))) {
      pending = { token, at: now }
    }
  }

  useEventListener(window, 'keydown', onKeydown)
}
