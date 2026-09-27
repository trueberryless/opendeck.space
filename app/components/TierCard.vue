<script setup lang="ts">
import { TIER_ICONS, type Tier, type TierSummary } from '~/utils/tiers'

const props = defineProps<{ tier: Tier; summary?: TierSummary | null }>()

const weeks = computed(() => {
  const days = props.summary?.days ?? []
  return Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7))
})
</script>

<template>
  <div :class="`tier-${tier}`" class="border-default surface overflow-hidden rounded-xl border">
    <div class="tier-gradient h-1.5" aria-hidden="true" />
    <div class="space-y-4 p-4">
      <div class="flex items-start gap-4">
        <div
          class="tier-gradient flex size-14 shrink-0 items-center justify-center rounded-2xl text-neutral-950 shadow-lg"
          aria-hidden="true"
        >
          <UIcon :name="TIER_ICONS[tier]" class="size-7" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-muted text-xs font-medium tracking-wide uppercase">{{ $t('tier.title') }}</p>
            <slot name="badge" />
          </div>
          <p class="tier-text text-2xl font-bold tracking-tight">{{ $t(`tier.names.${tier}`) }}</p>
        </div>
        <slot name="actions" />
      </div>

      <template v-if="summary">
        <div>
          <p class="sr-only">{{ $t('tier.window', { count: summary.activeDays }, summary.activeDays) }}</p>
          <div class="grid grid-cols-4 gap-2" aria-hidden="true">
            <div v-for="(week, w) in weeks" :key="w" class="grid grid-cols-7 gap-1">
              <span
                v-for="(active, d) in week"
                :key="d"
                class="aspect-square rounded-sm"
                :class="active ? 'tier-gradient' : 'bg-neutral-200 dark:bg-neutral-800'"
              />
            </div>
          </div>
          <p class="text-muted mt-1.5 text-xs" aria-hidden="true">
            {{ $t('tier.window', { count: summary.activeDays }, summary.activeDays) }}
          </p>
        </div>

        <div v-if="summary.next" class="space-y-1.5">
          <div class="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
            <div
              :class="`tier-${summary.next}`"
              class="tier-gradient h-full rounded-full transition-[width] duration-700"
              :style="{ width: `${Math.max(4, summary.progress * 100)}%` }"
            />
          </div>
          <p class="text-sm">
            <template v-if="summary.atRisk">{{ $t('tier.keep', { tier: $t(`tier.names.${tier}`) }) }}</template>
            <template v-else-if="summary.daysToNext">
              {{
                $t(
                  'tier.toNext',
                  { count: summary.daysToNext, tier: $t(`tier.names.${summary.next}`) },
                  summary.daysToNext,
                )
              }}
            </template>
          </p>
        </div>
        <p v-else class="text-sm">
          {{ summary.atRisk ? $t('tier.keep', { tier: $t(`tier.names.${tier}`) }) : $t('tier.top') }}
        </p>
      </template>
    </div>
  </div>
</template>
