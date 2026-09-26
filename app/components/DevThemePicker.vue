<script setup lang="ts">
import { ROLES, type Role } from '~~/shared/credits'
import { TIERS, type Tier } from '~/utils/tiers'

const tier = defineModel<Tier | null>('tier', { required: true })
const roles = defineModel<Role[]>('roles', { required: true })
const celebrate = useTierCelebration()
const open = useLocalStorage('opendeck-dev-theme-preview-open', true)

useShortcuts('dev-theme', 'Theme preview', [
  { keys: ['shift+p'], label: 'Show or hide the theme preview', run: () => (open.value = !open.value) },
])

function toggleRole(role: Role) {
  roles.value = roles.value.includes(role)
    ? roles.value.filter((r) => r !== role)
    : ROLES.filter((r) => r === role || roles.value.includes(r))
}
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
          @click="celebrate = tier ?? 'gold'"
        />
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="t in TIERS"
          :key="t"
          type="button"
          class="rounded-full focus-visible:outline-2"
          :class="tier === t ? 'ring-accent ring-2 ring-offset-2 ring-offset-(--ui-bg)' : ''"
          :aria-pressed="tier === t"
          @click="tier = tier === t ? null : t"
        >
          <TierBadge :tier="t" size="sm" />
        </button>
      </div>
      <div class="border-default flex flex-wrap gap-1.5 border-t pt-3">
        <button
          v-for="r in ROLES"
          :key="r"
          type="button"
          class="rounded-full focus-visible:outline-2"
          :class="roles.includes(r) ? 'ring-accent ring-2 ring-offset-2 ring-offset-(--ui-bg)' : 'opacity-60'"
          :aria-pressed="roles.includes(r)"
          @click="toggleRole(r)"
        >
          <RoleBadge :credit="{ role: r }" />
        </button>
      </div>
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
