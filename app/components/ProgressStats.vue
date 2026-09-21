<script setup lang="ts">
import type { StudyStats } from '~/composables/useStats'

const props = defineProps<{ stats: StudyStats }>()

const maxCount = computed(() => Math.max(1, ...props.stats.last7.map((d) => d.count)))
const totalWeek = computed(() => props.stats.last7.reduce((n, d) => n + d.count, 0))

const shown = ref(false)
onMounted(() => requestAnimationFrame(() => (shown.value = true)))

const lastActiveLabel = computed(() => {
  if (!props.stats.lastActive) return 'never'
  const d = new Date(props.stats.lastActive)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString()
})

const tiles = computed(() => [
  { label: 'Learned', value: props.stats.learned, icon: 'i-lucide-check-check' },
  { label: 'Learning', value: props.stats.learning, icon: 'i-lucide-repeat' },
  { label: 'Reviews', value: props.stats.reviews, icon: 'i-lucide-list-checks' },
  { label: 'Day streak', value: props.stats.streak, icon: 'i-lucide-flame' },
])
</script>

<template>
  <div class="space-y-4">
    <!-- Key numbers -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div v-for="t in tiles" :key="t.label" class="border-default rounded-lg border p-3">
        <div class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <UIcon :name="t.icon" class="size-3.5" />{{ t.label }}
        </div>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ t.value }}</p>
      </div>
    </div>

    <!-- Weekly activity bar chart -->
    <div class="border-default rounded-lg border p-4">
      <div class="mb-3 flex items-baseline justify-between">
        <p class="text-sm font-medium">Studied in the last 7 days</p>
        <p class="text-xs text-neutral-400">{{ totalWeek }} total</p>
      </div>
      <div class="flex h-28 items-end gap-2" role="img" aria-label="Cards studied each of the last seven days">
        <div v-for="(d, i) in stats.last7" :key="i" class="flex flex-1 flex-col items-center gap-1.5">
          <div class="flex w-full flex-1 items-end">
            <div
              class="bg-accent w-full rounded-t transition-[height] duration-700 ease-out"
              :style="{
                height: shown ? `${Math.max(d.count ? 6 : 0, (d.count / maxCount) * 100)}%` : '0%',
                transitionDelay: `${i * 60}ms`,
              }"
              :aria-label="`${d.label}: ${d.count}`"
              :title="`${d.count} on ${d.label}`"
            />
          </div>
          <span class="text-[10px] text-neutral-400">{{ d.label }}</span>
        </div>
      </div>
    </div>

    <!-- Secondary facts -->
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="border-default rounded-lg border p-3">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">Last studied</p>
        <p class="mt-1 font-medium">{{ lastActiveLabel }}</p>
      </div>
      <div class="border-default rounded-lg border p-3">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">Most trained term</p>
        <p class="mt-1 truncate font-medium">{{ stats.mostTrained?.front ?? 'None yet' }}</p>
      </div>
    </div>
  </div>
</template>
