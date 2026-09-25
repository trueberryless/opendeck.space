<script setup lang="ts">
import type { Role } from '~/utils/credits'

const props = defineProps<{ role: Role }>()

const GLYPHS: Record<Role, string[]> = {
  creator: ['✦', '✧', '✦'],
  maintainer: ['⚙', '⚙', '✦'],
  contributor: ['{ }', '</>', '=>', ';', '()', '#', '&&', '[ ]'],
  translator: ['あ', 'Ж', 'ع', '한', 'Ω', 'ñ', 'ß', 'अ', 'ש', '文', 'ç', 'ø'],
  designer: ['●', '◆', '▲', '■', '✦'],
  tester: ['✓', '✓', '◉', '✓', '⚑'],
}

const STARS = [
  [6, 62],
  [14, 30],
  [23, 48],
  [31, 18],
  [42, 40],
  [51, 70],
  [60, 28],
  [69, 52],
  [78, 22],
  [86, 60],
  [94, 36],
] as const

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const glyphs = computed(() => {
  const random = seeded(props.role.length * 31 + 5)
  const set = GLYPHS[props.role]
  return Array.from({ length: 12 }, (_, i) => ({
    text: set[i % set.length],
    style: {
      left: `${3 + random() * 92}%`,
      '--y': `${10 + random() * 70}%`,
      '--size': `${11 + random() * 9}px`,
      '--delay': `${-random() * 12}s`,
      '--duration': `${8 + random() * 6}s`,
      '--turn': `${props.role === 'maintainer' ? 180 : Math.round((random() - 0.5) * 40)}deg`,
    },
  }))
})
</script>

<template>
  <div class="role-ornament" aria-hidden="true">
    <div v-if="role === 'maintainer'" class="role-grid" />
    <svg v-if="role === 'creator'" class="role-constellation" viewBox="0 0 100 80" preserveAspectRatio="none">
      <line
        v-for="(star, i) in STARS.slice(1)"
        :key="`l${i}`"
        :x1="STARS[i]![0]"
        :y1="STARS[i]![1]"
        :x2="star[0]"
        :y2="star[1]"
      />
    </svg>
    <template v-if="role === 'creator'">
      <span
        v-for="(star, i) in STARS"
        :key="`s${i}`"
        class="role-star"
        :style="{ left: `${star[0]}%`, top: `${(star[1] / 80) * 100}%`, '--delay': `${-i * 0.7}s` }"
      />
    </template>
    <span v-for="(glyph, i) in glyphs" :key="i" class="role-glyph" :style="glyph.style">{{ glyph.text }}</span>
  </div>
</template>
