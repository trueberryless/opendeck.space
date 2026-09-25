<script setup lang="ts">
import { ROLES, type Role } from '~~/shared/credits'
import { TIERS, type Tier } from '~/utils/tiers'

const tier = defineModel<Tier | null>('tier', { required: true })
const roles = defineModel<Role[]>('roles', { required: true })
const celebrate = useTierCelebration()

function toggleRole(role: Role) {
  roles.value = roles.value.includes(role)
    ? roles.value.filter((r) => r !== role)
    : ROLES.filter((r) => r === role || roles.value.includes(r))
}
</script>

<template>
  <div
    class="border-default bg-default fixed start-4 bottom-24 z-50 w-76 space-y-3 rounded-xl border p-3 shadow-xl md:bottom-4"
    role="group"
    aria-label="Theme preview"
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
</template>
