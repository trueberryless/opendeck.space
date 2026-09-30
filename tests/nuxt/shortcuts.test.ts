import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  isSingleKey,
  useShortcutDispatcher,
  useShortcutGroups,
  useShortcuts,
  type Shortcut,
} from '~/composables/useShortcuts'
import '../support/reset'

function mountShortcuts(shortcuts: Shortcut[]) {
  return mountSuspended(
    defineComponent({
      setup() {
        useShortcuts('test', 'Test', () => shortcuts)
        useShortcutDispatcher()
        return () => h('div', [h('button', { id: 'btn' }, 'x'), h('input', { id: 'input' })])
      },
    }),
    { attachTo: document.body },
  )
}

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = window) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))

describe('isSingleKey', () => {
  it('distinguishes single keys from modified ones', () => {
    expect(isSingleKey('j')).toBe(true)
    expect(isSingleKey('space')).toBe(true)
    expect(isSingleKey('shift+g')).toBe(true)
    expect(isSingleKey('mod+k')).toBe(false)
    expect(isSingleKey('enter')).toBe(false)
  })
})

describe('shortcut dispatcher', () => {
  it('runs the shortcut for a key and prevents the default', async () => {
    const run = vi.fn()
    const wrapper = await mountShortcuts([{ keys: ['j'], label: 'Next', run }])
    const event = new KeyboardEvent('keydown', { key: 'j', cancelable: true })
    window.dispatchEvent(event)
    expect(run).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('supports sequences and times out', async () => {
    const run = vi.fn()
    const wrapper = await mountShortcuts([{ keys: ['g h'], label: 'Home', run }])
    press('g')
    press('h')
    expect(run).toHaveBeenCalledOnce()
    press('h')
    expect(run).toHaveBeenCalledOnce()
    press('g')
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)
    press('h')
    expect(run).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('maps space, shift and modifier keys', async () => {
    const space = vi.fn()
    const shift = vi.fn()
    const mod = vi.fn()
    const wrapper = await mountShortcuts([
      { keys: ['space'], label: 's', run: space },
      { keys: ['shift+g'], label: 'g', run: shift },
      { keys: ['mod+k'], label: 'k', run: mod },
    ])
    press(' ')
    press('G', { shiftKey: true })
    press('k', { ctrlKey: true })
    press('k', { metaKey: true })
    press('Shift')
    press('j', { altKey: true })
    expect([space.mock.calls.length, shift.mock.calls.length, mod.mock.calls.length]).toEqual([1, 1, 2])
    wrapper.unmount()
  })

  it('ignores typing in inputs and repeated or composing events', async () => {
    const run = vi.fn()
    const wrapper = await mountShortcuts([{ keys: ['j'], label: 'Next', run }])
    press('j', {}, document.getElementById('input')!)
    press('j', { repeat: true })
    press('j', { isComposing: true })
    expect(run).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not steal activation keys from focused buttons unless allowed', async () => {
    const run = vi.fn()
    const interactive = vi.fn()
    const wrapper = await mountShortcuts([
      { keys: ['enter'], label: 'a', run },
      { keys: ['arrowright'], label: 'b', run: interactive, onInteractive: true },
    ])
    const button = document.getElementById('btn')!
    press('Enter', {}, button)
    press('ArrowRight', {}, button)
    expect(run).not.toHaveBeenCalled()
    expect(interactive).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('respects the when condition and the single key setting', async () => {
    const run = vi.fn()
    const off = ref(false)
    const wrapper = await mountShortcuts([
      { keys: ['j'], label: 'a', run, when: () => off.value },
      { keys: ['mod+j'], label: 'b', run },
    ])
    press('j')
    expect(run).not.toHaveBeenCalled()
    off.value = true
    press('j')
    expect(run).toHaveBeenCalledOnce()
    localStorage.setItem('opendeck-single-key-shortcuts', 'false')
    wrapper.unmount()
  })
})

describe('shortcut groups', () => {
  it('lists mounted groups and unregisters them on unmount', async () => {
    const groups = useShortcutGroups()
    const wrapper = await mountShortcuts([
      { keys: ['j'], label: 'Visible' },
      { keys: ['k'], label: 'Hidden', when: () => false },
    ])
    expect(groups.value).toEqual([{ id: 'test', title: 'Test', shortcuts: [{ keys: ['j'], label: 'Visible' }] }])
    wrapper.unmount()
    expect(groups.value).toEqual([])
  })
})
