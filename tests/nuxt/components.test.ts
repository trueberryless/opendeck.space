import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import BattleQuestion from '~/components/BattleQuestion.vue'
import CardEditor from '~/components/CardEditor.vue'
import ChallengeStandings from '~/components/ChallengeStandings.vue'
import DeckCard from '~/components/DeckCard.vue'
import DeckEditor from '~/components/DeckEditor.vue'
import FileDrop from '~/components/FileDrop.vue'
import ProgressStats from '~/components/ProgressStats.vue'
import StudyCard from '~/components/StudyCard.vue'
import TierBadge from '~/components/TierBadge.vue'
import VisibilityRow from '~/components/VisibilityRow.vue'
import type { DeckView } from '~/composables/useDecks'
import type { BattleView } from '~/utils/battle/game'
import { computeStats } from '~/utils/stats'
import '../support/reset'

const deck = (over: Partial<DeckView['value']> = {}, visibility: DeckView['visibility'] = 'public'): DeckView => ({
  uri: 'at://x/y/z',
  cid: 'c',
  rkey: 'z',
  author: 'did:plc:me',
  visibility,
  value: { title: 'Spanish basics', createdAt: '', ...over },
})

describe('DeckCard', () => {
  it('shows the title, summary, languages, card count and tags', async () => {
    const wrapper = await mountSuspended(DeckCard, {
      props: {
        deck: deck({ summary: 'Words', sourceLang: 'es', targetLang: 'en', tags: ['a', 'b', 'c', 'd', 'e'] }),
        to: '/decks/x/z',
        cardCount: 3,
      },
    })
    const text = wrapper.text()
    expect(text).toContain('Spanish basics')
    expect(text).toContain('Words')
    expect(text).toContain('es')
    expect(text).toContain('en')
    expect(text).toContain('3')
    expect(wrapper.findAll('.rounded-sm, [class*="badge"]').length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain('e\n')
    expect(wrapper.attributes('href')).toBe('/decks/x/z')
  })

  it('marks private decks and handles a single language', async () => {
    const wrapper = await mountSuspended(DeckCard, { props: { deck: deck({ targetLang: 'ja' }, 'private'), to: '/x' } })
    expect(wrapper.find('.sr-only').text()).toBeTruthy()
    expect(wrapper.text()).toContain('ja')
  })
})

describe('StudyCard', () => {
  const base = { front: 'hola', back: 'hello', showHint: false, revealed: false }

  it('shows only the front until revealed', async () => {
    const wrapper = await mountSuspended(StudyCard, { props: base })
    expect(wrapper.text()).toContain('hola')
    expect(wrapper.text()).not.toContain('hello')
    await wrapper.setProps({ revealed: true, examples: ['hola amigo'] })
    expect(wrapper.text()).toContain('hello')
    expect(wrapper.text()).toContain('“hola amigo”')
  })

  it('offers the hint and asks to reveal it', async () => {
    const wrapper = await mountSuspended(StudyCard, { props: { ...base, hint: 'greeting' } })
    expect(wrapper.text()).not.toContain('greeting')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('revealHint')).toHaveLength(1)
    await wrapper.setProps({ showHint: true })
    expect(wrapper.text()).toContain('greeting')
  })

  it.each([
    ['answer', { promptReading: 'PR', answerReading: 'AR' }, 'AR', 'PR'],
    ['prompt', { promptReading: 'PR', answerReading: 'AR' }, 'PR', 'AR'],
  ] as const)('shows the %s reading only', async (mode, readings, shown, hidden) => {
    const wrapper = await mountSuspended(StudyCard, {
      props: { ...base, revealed: true, readingMode: mode, ...readings },
    })
    expect(wrapper.text()).toContain(shown)
    expect(wrapper.text()).not.toContain(hidden)
  })

  it('moves the prompt reading into the hint in hint mode', async () => {
    const wrapper = await mountSuspended(StudyCard, {
      props: { ...base, showHint: true, readingMode: 'hint', promptReading: 'PR', hint: 'h' },
    })
    expect(wrapper.text()).toContain('h · PR')
  })
})

describe('TierBadge', () => {
  it('renders the tier name with its class', async () => {
    const wrapper = await mountSuspended(TierBadge, { props: { tier: 'gold', size: 'sm' } })
    expect(wrapper.classes()).toContain('tier-gold')
    expect(wrapper.text()).toBeTruthy()
  })
})

describe('VisibilityRow', () => {
  it('lets the user pick who sees something and locks options', async () => {
    const wrapper = await mountSuspended(VisibilityRow, {
      props: {
        title: 'Tier',
        modelValue: 'me' as const,
        locked: ['everyone' as const],
        lockedHint: 'Locked',
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v as never }),
      },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(buttons[2]!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Locked')
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['nobody'])
  })
})

describe('FileDrop', () => {
  it('emits the dropped files', async () => {
    const wrapper = await mountSuspended(FileDrop, { props: { multiple: true } })
    const file = new File(['x'], 'a.csv')
    await wrapper.trigger('dragover')
    expect(wrapper.classes().join(' ')).toContain('bg-muted')
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    expect(wrapper.emitted('files')?.[0]).toEqual([[file]])
  })

  it('opens the file picker from the keyboard', async () => {
    const wrapper = await mountSuspended(FileDrop, { attachTo: document.body })
    const input = wrapper.find('input').element as HTMLInputElement
    let clicked = 0
    input.addEventListener('click', (event) => {
      clicked++
      event.stopPropagation()
    })
    await wrapper.trigger('keydown.enter')
    await wrapper.trigger('keydown.space')
    expect(clicked).toBe(2)
    wrapper.unmount()
  })
})

describe('DeckEditor', () => {
  it('does not save without a title', async () => {
    const wrapper = await mountSuspended(DeckEditor)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('emits trimmed data with tags and visibility', async () => {
    const wrapper = await mountSuspended(DeckEditor, {
      props: { deck: { title: ' Old ', tags: ['x'] }, showVisibility: true, visibility: 'public' },
    })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('  New title  ')
    await inputs.find((i) => i.attributes('placeholder') === 'en')!.setValue('de')
    await wrapper
      .findAll('button')
      .find((b) => b.attributes('aria-pressed') === 'false')!
      .trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({
      title: 'New title',
      sourceLang: 'de',
      tags: ['x'],
      visibility: 'private',
      readingMode: 'answer',
    })
  })

  it('emits cancel', async () => {
    const wrapper = await mountSuspended(DeckEditor)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Cancel')!
      .trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})

describe('CardEditor', () => {
  it('needs a front and a back', async () => {
    const wrapper = await mountSuspended(CardEditor)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('emits a cleaned card with examples split by line', async () => {
    const wrapper = await mountSuspended(CardEditor, {
      props: { card: { front: ' hola ', back: 'hello', examples: ['one', 'two'], order: 4 } },
    })
    const areas = wrapper.findAll('textarea')
    await areas[0]!.setValue(' hola ')
    await areas.find((a) => a.element.value === 'one\ntwo')!.setValue('a\n\n b \n')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({
      front: 'hola',
      back: 'hello',
      examples: ['a', 'b'],
      order: 4,
      hint: undefined,
    })
  })

  it('submits with ctrl+enter', async () => {
    const wrapper = await mountSuspended(CardEditor, { props: { card: { front: 'a', back: 'b' } } })
    await wrapper.find('form').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })
})

describe('ProgressStats', () => {
  const stats = computeStats([], [], new Map())

  it('shows the tiles and empty states', async () => {
    const wrapper = await mountSuspended(ProgressStats, { props: { stats } })
    expect(wrapper.findAll('.tabular-nums').length).toBeGreaterThan(3)
    expect(wrapper.text()).toContain('0')
  })

  it('hides private numbers on shared stats and shows when they were updated', async () => {
    const shared = await mountSuspended(ProgressStats, {
      props: { stats: { ...stats, updatedAt: '2026-06-01T00:00:00Z' }, shared: true },
    })
    const own = await mountSuspended(ProgressStats, { props: { stats } })
    expect(shared.findAll('.surface').length).toBeLessThan(own.findAll('.surface').length)
    expect(shared.text()).toMatch(/2026|Jun/)
  })

  it('describes when the learner last studied', async () => {
    const today = await mountSuspended(ProgressStats, {
      props: { stats: { ...stats, lastActive: new Date().toISOString(), retention: 0.9, yearSeconds: 7200 } },
    })
    expect(today.text()).toContain('90%')
    expect(today.text()).toContain('2')
    const old = await mountSuspended(ProgressStats, {
      props: { stats: { ...stats, lastActive: '2020-01-01T00:00:00Z', yearSeconds: 300 } },
    })
    expect(old.text()).toMatch(/2020|1\/1/)
  })
})

describe('ChallengeStandings', () => {
  const rows = [
    { did: 'did:a', studied: 3, survived: 3, out: false, rank: 1, marks: ['done', 'done', 'open'] as const },
    { did: 'did:b', studied: 1, survived: 1, out: true, rank: 2, marks: ['done', 'missed', 'open'] as const },
  ]
  const profiles = new Map([['did:a', { did: 'did:a', handle: 'a.test', displayName: 'Alice' }]])

  it('lists participants with their rank and marks the current user', async () => {
    const wrapper = await mountSuspended(ChallengeStandings, {
      props: { rows: rows as never, kind: 'everyDay', profiles, me: 'did:a', ended: false },
    })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]!.attributes('aria-current')).toBe('true')
    expect(items[0]!.text()).toContain('Alice')
    expect(items[1]!.text()).toContain('did:b')
    expect(items[1]!.find('.line-through').exists()).toBe(true)
  })

  it('shows a trophy for the winner once the challenge ended', async () => {
    const wrapper = await mountSuspended(ChallengeStandings, {
      props: { rows: rows as never, kind: 'studyDays', profiles, ended: true },
    })
    expect(wrapper.find('li [aria-label="1"]').exists()).toBe(true)
  })
})

describe('BattleQuestion', () => {
  const view: BattleView = {
    phase: 'question',
    deck: 'd',
    round: 2,
    rounds: 10,
    handicap: true,
    players: [
      { did: 'did:me', name: 'Me', tier: null, score: 0, multiplier: 1, answered: false, choice: null, gained: null },
    ],
    question: {
      prompt: 'hola',
      options: ['a', 'b', 'c', 'd'],
      promptReading: 'oh-la',
      hint: 'greeting',
      optionReadings: [null, 'r-b', null, null],
    },
    answer: null,
    remainingMs: 15000,
  }

  it('shows the prompt, options, hint and readings', async () => {
    const wrapper = await mountSuspended(BattleQuestion, {
      props: { view, viewAt: performance.now(), choice: null, me: 'did:me' },
    })
    expect(wrapper.text()).toContain('hola')
    expect(wrapper.text()).toContain('oh-la')
    expect(wrapper.text()).toContain('greeting')
    expect(wrapper.text()).toContain('r-b')
    expect(wrapper.findAll('button[aria-pressed][aria-keyshortcuts]')).toHaveLength(4)
    wrapper.unmount()
  })

  it('emits the chosen option and locks after answering', async () => {
    const wrapper = await mountSuspended(BattleQuestion, {
      props: { view, viewAt: performance.now(), choice: null, me: 'did:me' },
    })
    const options = wrapper.findAll('button[aria-pressed][aria-keyshortcuts]')
    await options[2]!.trigger('click')
    expect(wrapper.emitted('answer')![0]).toEqual([2])
    await wrapper.setProps({ choice: 2 })
    expect(
      wrapper.findAll('button[aria-pressed][aria-keyshortcuts]').every((b) => b.attributes('disabled') !== undefined),
    ).toBe(true)
    wrapper.unmount()
  })

  it('reveals the right answer and reports the result', async () => {
    const revealed = {
      ...view,
      phase: 'reveal' as const,
      answer: 1,
      remainingMs: 0,
      players: [{ ...view.players[0]!, gained: 800 }],
    }
    const wrapper = await mountSuspended(BattleQuestion, {
      props: { view: revealed, viewAt: performance.now(), choice: 1, me: 'did:me' },
    })
    expect(wrapper.find('[role="status"]').text()).toContain('+800')
    expect(wrapper.findAll('button[aria-pressed][aria-keyshortcuts]')[1]!.classes().join(' ')).toContain(
      'border-success',
    )
    await wrapper.setProps({ choice: 0 })
    expect(wrapper.findAll('button[aria-pressed][aria-keyshortcuts]')[0]!.classes().join(' ')).toContain('border-error')
    await wrapper.setProps({ choice: null })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders nothing without a question', async () => {
    const wrapper = await mountSuspended(BattleQuestion, {
      props: { view: { ...view, question: null }, viewAt: 0, choice: null },
    })
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
})
