<script setup lang="ts">
import { TIER_ICONS, type Tier } from '~/utils/tiers'

withDefaults(defineProps<{ tier: Tier; size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <span
    :class="[
      `tier-${tier}`,
      'tier-badge inline-flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap',
      size === 'sm' ? 'px-2 py-px text-xs' : 'px-2.5 py-0.5 text-sm',
    ]"
  >
    <UIcon :name="TIER_ICONS[tier]" :class="size === 'sm' ? 'size-3.5' : 'size-4'" aria-hidden="true" />
    {{ $t(`tier.names.${tier}`) }}
  </span>
</template>
