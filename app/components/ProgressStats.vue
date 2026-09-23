<script setup lang="ts">
import type { StudyStats } from '~/composables/useStats'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const props = defineProps<{ stats: StudyStats }>()

const lastActiveLabel = computed(() => {
  if (!props.stats.lastActive) return t('progressStats.never')
  const d = new Date(props.stats.lastActive)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return t('progressStats.today')
  if (days === 1) return t('progressStats.yesterday')
  if (days < 7) return t('progressStats.daysAgo', { count: days }, days)
  return d.toLocaleDateString()
})

const timeStudiedLabel = computed(() => {
  const minutes = Math.round(props.stats.yearSeconds / 60)
  const inHours = minutes >= 60
  return new Intl.NumberFormat(locale.value, {
    style: 'unit',
    unit: inHours ? 'hour' : 'minute',
    unitDisplay: 'short',
    maximumFractionDigits: inHours ? 1 : 0,
  }).format(inHours ? minutes / 60 : minutes)
})

const retentionLabel = computed(() =>
  props.stats.retention === null
    ? t('progressStats.noneYet')
    : new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(props.stats.retention),
)

const tiles = computed(() => [
  { label: t('progressStats.learned'), value: props.stats.learned, icon: 'i-lucide-check-check' },
  { label: t('progressStats.learning'), value: props.stats.learning, icon: 'i-lucide-repeat' },
  { label: t('progressStats.reviews'), value: props.stats.reviews, icon: 'i-lucide-list-checks' },
  { label: t('progressStats.streak'), value: props.stats.streak, icon: 'i-lucide-flame' },
])
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div v-for="t in tiles" :key="t.label" class="border-default rounded-lg border p-3">
        <div class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <UIcon :name="t.icon" class="size-3.5" />{{ t.label }}
        </div>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ t.value }}</p>
      </div>
    </div>

    <div class="border-default rounded-lg border p-4">
      <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p class="text-sm font-medium">
          {{ $t('progressStats.yearReviews', { count: stats.yearReviews }, stats.yearReviews) }}
        </p>
        <p class="text-xs text-neutral-400">
          {{ $t('progressStats.activeDays', { count: stats.yearActiveDays }, stats.yearActiveDays) }} ·
          {{ $t('progressStats.longestStreak', { count: stats.longestStreak }, stats.longestStreak) }}
        </p>
      </div>
      <StudyHeatmap :activity="stats.activity" />
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="border-default rounded-lg border p-3">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ $t('progressStats.lastStudied') }}</p>
        <p class="mt-1 font-medium">{{ lastActiveLabel }}</p>
      </div>
      <div class="border-default rounded-lg border p-3">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ $t('progressStats.mostTrained') }}</p>
        <p class="mt-1 truncate font-medium">{{ stats.mostTrained?.front ?? $t('progressStats.noneYet') }}</p>
      </div>
      <div class="border-default rounded-lg border p-3">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ $t('progressStats.timeStudied') }}</p>
        <p class="mt-1 font-medium tabular-nums">{{ timeStudiedLabel }}</p>
      </div>
      <div class="border-default rounded-lg border p-3">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ $t('progressStats.retention') }}</p>
        <p class="mt-1 font-medium tabular-nums">{{ retentionLabel }}</p>
      </div>
    </div>
  </div>
</template>
