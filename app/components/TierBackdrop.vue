<script setup lang="ts">
import type { Role } from '~~/shared/credits'
import { ROLE_GLYPHS } from '~/utils/credits'
import { latticeTile, tierRank, tierTile, type Tier } from '~/utils/tiers'

const props = defineProps<{ tier: Tier | null; role?: Role | null }>()

const RAINBOW = ['#ff9a9e', '#fbc37a', '#f6f08a', '#8ee6a8', '#7fd3f7', '#a9a4ff', '#f0a6ff']

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const rank = computed(() => (props.tier ? tierRank(props.tier) : 0))
const supernova = computed(() => props.tier === 'supernova')

const layers = computed(() => {
  const size = 176 - rank.value * 11
  const front = {
    ...(props.role
      ? { '--tier-tile': latticeTile(props.tier, ROLE_GLYPHS[props.role]), '--tier-size': `${size * 2}px` }
      : { '--tier-tile': tierTile(props.tier!), '--tier-size': `${size}px` }),
    '--tier-speed': '32s',
    opacity: 0.22,
  }
  if (!props.tier || rank.value < 2) return [front]
  const small = Math.round(size * 0.55)
  return [
    {
      '--tier-tile': tierTile(props.tier),
      '--tier-size': `${small}px`,
      '--tier-speed': '46s',
      '--tier-x': `${Math.round(small * 0.3)}px`,
      opacity: 0.1,
    },
    front,
  ]
})

const sparkles = computed(() => {
  const random = seeded(7)
  const count = rank.value >= 4 ? (rank.value - 3) * 8 : 0
  return Array.from({ length: count }, () => ({
    left: `${random() * 100}%`,
    top: `${random() * 100}%`,
    '--size': `${8 + random() * 10}px`,
    '--delay': `${-random() * 6}s`,
    '--duration': `${4 + random() * 4}s`,
  }))
})

const orbs = computed(() => {
  const random = seeded(13)
  return Array.from({ length: rank.value >= 6 ? 6 : 0 }, () => ({
    left: `${random() * 90}%`,
    '--y': `${10 + random() * 70}%`,
    '--size': `${80 + random() * 120}px`,
    '--delay': `${-random() * 40}s`,
    '--duration': `${34 + random() * 20}s`,
  }))
})

const clouds = computed(() => {
  if (!supernova.value) return []
  const random = seeded(29)
  return RAINBOW.slice(0, 6).map((color, i) => ({
    top: `${8 + i * 15 + random() * 6}%`,
    '--x': `${random() * 80}%`,
    '--color': color,
    '--size': `${260 + random() * 200}px`,
    '--delay': `${-random() * 60}s`,
    '--duration': `${50 + random() * 30}s`,
  }))
})
</script>

<template>
  <div :class="['tier-backdrop', tier ? `tier-${tier}` : `role-backdrop role-${role}`]" aria-hidden="true">
    <div v-if="supernova" class="tier-rainbow" />
    <div v-if="rank >= 3" class="tier-aurora" />
    <div v-if="rank >= 5" class="tier-light-rays" />
    <span v-for="(style, i) in clouds" :key="`cloud-${i}`" class="tier-cloud" :style="style" />
    <div class="tier-backdrop-fade">
      <div v-for="(style, i) in layers" :key="i" class="tier-backdrop-layer" :style="style" />
    </div>
    <span v-for="(style, i) in orbs" :key="`orb-${i}`" class="tier-orb" :style="style" />
    <span v-for="(style, i) in sparkles" :key="`sparkle-${i}`" class="tier-twinkle" :style="style" />
  </div>
  <div v-if="supernova" class="tier-grain" aria-hidden="true" />
</template>
