<script setup lang="ts">
import { tierTile, type Tier } from '~/utils/tiers'

const props = defineProps<{ tier: Tier }>()

const style = computed(() => ({
  '--tier-tile': tierTile(props.tier),
  '--tier-size': '152px',
  '--tier-speed': '32s',
}))
</script>

<template>
  <div :class="['tier-backdrop', `tier-${tier}`]" aria-hidden="true">
    <div class="tier-backdrop-fade">
      <div class="tier-backdrop-layer opacity-25 dark:opacity-20" :style="style" />
    </div>
  </div>
</template>
