<script setup lang="ts">
import { TIERS, type Tier } from '~/utils/tiers'

const tier = defineModel<Tier | null>({ required: true })
const celebrate = useTierCelebration()
</script>

<template>
  <div
    class="border-default bg-default fixed start-4 bottom-24 z-50 w-72 space-y-2 rounded-xl border p-3 shadow-xl md:bottom-4"
    role="group"
    aria-label="Tier preview"
  >
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold">Tier preview <span class="text-muted font-normal">· dev only</span></p>
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
  </div>
</template>
