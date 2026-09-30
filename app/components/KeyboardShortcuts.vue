<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const open = useShortcutHelp()
const enabled = useShortcutsEnabled()
const groups = useShortcutGroups()
const colorMode = useColorMode()
const isLoggedIn = useIsLoggedIn()
const switchId = useId()

useShortcutDispatcher()

function go(path: string) {
  return () => navigateTo(path)
}

useShortcuts(
  'general',
  () => t('shortcuts.groups.general'),
  () => [
    { keys: ['?', 'mod+/'], label: t('shortcuts.open'), run: () => (open.value = !open.value) },
    {
      keys: ['t'],
      label: t('shortcuts.toggleTheme'),
      run: () => (colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'),
    },
    { keys: ['n'], label: t('shortcuts.newDeck'), run: go('/decks/new'), when: () => isLoggedIn.value },
  ],
)

useShortcuts(
  'navigation',
  () => t('shortcuts.groups.navigation'),
  () => [
    { keys: ['g h'], label: t('shortcuts.goHome'), run: go('/') },
    { keys: ['g d'], label: t('shortcuts.goDiscover'), run: go('/discover') },
    { keys: ['g t'], label: t('shortcuts.goTogether'), run: go('/together'), when: () => isLoggedIn.value },
    { keys: ['g s'], label: t('shortcuts.goStudy'), run: go('/study'), when: () => isLoggedIn.value },
    { keys: ['g p'], label: t('shortcuts.goProfile'), run: go('/profile'), when: () => isLoggedIn.value },
    { keys: ['g i'], label: t('shortcuts.goImport'), run: go('/import'), when: () => isLoggedIn.value },
    { keys: [',', '.'], label: t('shortcuts.goSettings'), run: go('/settings'), when: () => isLoggedIn.value },
  ],
)

const orderedGroups = computed(() => {
  const order = ['general', 'navigation']
  const sorted = [...groups.value].sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    return (ia === -1 ? -1 : ia) - (ib === -1 ? -1 : ib)
  })
  const merged = new Map<string, (typeof sorted)[number]>()
  for (const group of sorted) {
    const existing = merged.get(group.title)
    if (existing) existing.shortcuts = [...existing.shortcuts, ...group.shortcuts]
    else merged.set(group.title, { ...group })
  }
  return [...merged.values()]
})

function parts(sequence: string): string[][] {
  return sequence.split(' ').map((token) =>
    token.split('+').map((part) => {
      if (part === 'mod') return 'meta'
      if (part === 'space') return t('shortcuts.space')
      if (part === 'home' || part === 'end') return part[0]!.toUpperCase() + part.slice(1)
      return part
    }),
  )
}

function dimmed(sequence: string): boolean {
  return !enabled.value && sequence.split(' ').some(isSingleKey)
}
</script>

<template>
  <UModal v-model:open="open" :title="$t('shortcuts.title')" :description="$t('shortcuts.description')">
    <template #body>
      <div class="space-y-6">
        <div class="border-default flex items-start justify-between gap-4 rounded-lg border p-3">
          <div class="min-w-0">
            <label :for="switchId" class="text-sm font-medium">{{ $t('shortcuts.singleKey') }}</label>
            <p :id="`${switchId}-hint`" class="text-muted text-xs">{{ $t('shortcuts.singleKeyHint') }}</p>
          </div>
          <USwitch :id="switchId" v-model="enabled" :aria-describedby="`${switchId}-hint`" />
        </div>

        <section v-for="group in orderedGroups" :key="group.id" class="space-y-2">
          <h3 class="text-muted text-xs font-semibold tracking-wide uppercase">{{ group.title }}</h3>
          <dl class="divide-default divide-y">
            <div
              v-for="shortcut in group.shortcuts"
              :key="shortcut.label"
              class="flex items-center justify-between gap-4 py-2 text-sm"
            >
              <dt>{{ shortcut.label }}</dt>
              <dd class="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <template v-for="(sequence, si) in shortcut.keys" :key="sequence">
                  <span v-if="si > 0" class="text-muted text-xs">{{ $t('shortcuts.or') }}</span>
                  <span class="inline-flex items-center gap-1" :class="dimmed(sequence) && 'line-through opacity-60'">
                    <template v-for="(token, ti) in parts(sequence)" :key="ti">
                      <span v-if="ti > 0" class="text-muted text-xs">{{ $t('shortcuts.then') }}</span>
                      <span class="inline-flex items-center gap-0.5">
                        <UKbd v-for="part in token" :key="part" :value="part" />
                      </span>
                    </template>
                  </span>
                </template>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
  </UModal>
</template>
