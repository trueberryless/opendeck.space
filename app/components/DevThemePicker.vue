<script setup lang="ts">
import { ROLES, type Role } from '~~/shared/credits'
import type { DevTier } from '~/utils/devTheme'
import { TIERS } from '~/utils/tiers'

defineProps<{ isSelf: boolean }>()
const tier = defineModel<DevTier>('tier', { required: true })
const roles = defineModel<Role[] | null>('roles', { required: true })
const visitor = defineModel<boolean>('visitor', { required: true })
const celebrate = useTierCelebration()
const open = useLocalStorage('opendeck-dev-theme-preview-open', true)

useShortcuts('dev-theme', 'Theme preview', [
  { keys: ['shift+p'], label: 'Show or hide the theme preview', run: () => (open.value = !open.value) },
])

function toggleRole(role: Role) {
  const current = roles.value ?? []
  const next = current.includes(role)
    ? current.filter((r) => r !== role)
    : ROLES.filter((r) => r === role || current.includes(r))
  roles.value = next.length ? next : null
}

const chip = (active: boolean) =>
  active ? 'bg-accent text-inverted ring-accent ring-2 ring-offset-2 ring-offset-(--ui-bg)' : 'bg-elevated text-muted'
</script>

<template>
  <div
    class="fixed start-0 bottom-24 z-50 flex items-end transition-transform duration-300 ease-out motion-reduce:transition-none md:bottom-4"
    :class="open ? '' : '-translate-x-80 rtl:translate-x-80'"
  >
    <div
      id="dev-theme-preview"
      class="border-default bg-default ms-4 w-76 space-y-3 rounded-xl border p-3 shadow-xl"
      role="group"
      aria-label="Theme preview"
      :inert="!open"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-semibold">Theme preview <span class="text-muted font-normal">· dev only</span></p>
        <UButton
          label="Celebrate"
          icon="i-lucide-party-popper"
          size="xs"
          color="neutral"
          variant="subtle"
          @click="celebrate = tier && tier !== 'none' ? tier : 'gold'"
        />
      </div>
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Tier">
        <button
          type="button"
          class="rounded-full px-2 py-px text-xs font-semibold focus-visible:outline-2"
          :class="chip(tier === null)"
          :aria-pressed="tier === null"
          @click="tier = null"
        >
          Real
        </button>
        <button
          type="button"
          class="rounded-full px-2 py-px text-xs font-semibold focus-visible:outline-2"
          :class="chip(tier === 'none')"
          :aria-pressed="tier === 'none'"
          @click="tier = 'none'"
        >
          None
        </button>
        <button
          v-for="t in TIERS"
          :key="t"
          type="button"
          class="rounded-full focus-visible:outline-2"
          :class="tier === t ? 'ring-accent ring-2 ring-offset-2 ring-offset-(--ui-bg)' : ''"
          :aria-pressed="tier === t"
          @click="tier = t"
        >
          <TierBadge :tier="t" size="sm" />
        </button>
      </div>
      <div class="border-default flex flex-wrap gap-1.5 border-t pt-3" role="group" aria-label="Roles">
        <button
          type="button"
          class="rounded-full px-2 py-px text-xs font-semibold focus-visible:outline-2"
          :class="chip(roles === null)"
          :aria-pressed="roles === null"
          @click="roles = null"
        >
          Real
        </button>
        <button
          type="button"
          class="rounded-full px-2 py-px text-xs font-semibold focus-visible:outline-2"
          :class="chip(roles?.length === 0)"
          :aria-pressed="roles?.length === 0"
          @click="roles = []"
        >
          None
        </button>
        <button
          v-for="r in ROLES"
          :key="r"
          type="button"
          class="rounded-full focus-visible:outline-2"
          :class="roles?.includes(r) ? 'ring-accent ring-2 ring-offset-2 ring-offset-(--ui-bg)' : 'opacity-60'"
          :aria-pressed="roles?.includes(r) ?? false"
          @click="toggleRole(r)"
        >
          <RoleBadge :credit="{ role: r }" />
        </button>
      </div>
      <div v-if="isSelf" class="border-default flex items-center justify-between gap-2 border-t pt-3">
        <label for="dev-theme-visitor" class="text-xs font-medium">View as visitor</label>
        <USwitch id="dev-theme-visitor" v-model="visitor" size="sm" />
      </div>
      <p class="text-muted text-xs">Real follows your settings. Picking a tier or role forces the themed look.</p>
    </div>
    <UButton
      :icon="open ? 'i-lucide-chevron-left' : 'i-lucide-palette'"
      :aria-label="open ? 'Hide theme preview' : 'Show theme preview'"
      :title="`${open ? 'Hide' : 'Show'} theme preview (Shift+P)`"
      :aria-expanded="open"
      aria-controls="dev-theme-preview"
      color="neutral"
      variant="subtle"
      class="ms-2 rounded-full shadow-lg"
      @click="open = !open"
    />
  </div>
</template>
