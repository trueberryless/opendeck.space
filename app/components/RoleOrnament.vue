<script setup lang="ts">
import type { Role } from '~~/shared/credits'
import { ROLE_GLYPHS } from '~/utils/credits'

const props = defineProps<{ role: Role; seed?: string }>()

const LAYERS = [
  { name: 'far', count: 44, rows: 4, size: [7, 10], speed: [46, 60] },
  { name: 'near', count: 22, rows: 3, size: [11, 15], speed: [26, 34] },
] as const

const FRONT = { count: 13, rows: 2, size: [20, 30] } as const

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

function seeded(text: string) {
  let state = [...text].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 2166136261)
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function scatter(count: number, rows: number, random: () => number) {
  const cols = Math.ceil(count / rows)
  return Array.from({ length: count }, (_, i) => ({
    x: ((i % cols) + 0.1 + random() * 0.8) * (100 / cols),
    y: (Math.floor(i / cols) + 0.1 + random() * 0.8) * (100 / rows),
  }))
}

const between = (random: () => number, [min, max]: readonly [number, number]) => min + random() * (max - min)

const set = computed(() => ROLE_GLYPHS[props.role])

const escape = (text: string) => text.replace(/[&<>]/g, (char) => `&#${char.charCodeAt(0)};`)

const layers = computed(() => {
  const random = seeded(`${props.role}:${props.seed ?? ''}:layers`)
  return LAYERS.map((layer) => {
    const speed = `${Math.round(between(random, layer.speed))}s`
    const glyphs = scatter(layer.count, layer.rows, random).map(({ x, y }) => ({
      x,
      y: y / 2,
      text: escape(set.value[Math.floor(random() * set.value.length)]!),
      size: Math.round(between(random, layer.size)),
      turn: Math.round((random() - 0.5) * 70),
    }))
    const html = [0, 50]
      .flatMap((offset) =>
        glyphs.map(
          (g) =>
            `<span class="role-glyph" style="left:${g.x}%;top:${g.y + offset}%;--size:${g.size}px;--turn:${g.turn}deg">${g.text}</span>`,
        ),
      )
      .join('')
    return { name: layer.name, style: { '--speed': speed }, html }
  })
})

const front = computed(() => {
  const random = seeded(`${props.role}:${props.seed ?? ''}:front`)
  return scatter(FRONT.count, FRONT.rows, random).map(({ x, y }, i) => ({
    text: set.value[i % set.value.length],
    style: {
      left: `${x}%`,
      top: `${y}%`,
      '--size': `${Math.round(between(random, FRONT.size))}px`,
      '--turn': `${Math.round((random() - 0.5) * 70)}deg`,
      '--delay': `${(-random() * 8).toFixed(1)}s`,
      '--duration': `${(6 + random() * 4).toFixed(1)}s`,
    },
  }))
})
</script>

<template>
  <div class="role-ornament" aria-hidden="true">
    <div v-if="role === 'maintainer'" class="role-grid" />
    <div
      v-for="layer in layers"
      :key="layer.name"
      :class="`role-drift role-drift-${layer.name}`"
      :style="layer.style"
      v-html="layer.html"
    />
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
    <span v-for="(glyph, i) in front" :key="i" class="role-glyph role-glyph-front" :style="glyph.style">{{
      glyph.text
    }}</span>
  </div>
</template>
