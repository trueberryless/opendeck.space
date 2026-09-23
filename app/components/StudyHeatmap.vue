<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { addDays, dayKey, startOfDay } from '~/utils/day'

const props = defineProps<{ activity: Record<string, number> }>()

const { t, locale } = useI18n()

const MAX_WEEKS = 53
const MIN_PITCH = 11
const LABEL_WIDTH = 32
const SHADES = [0, 30, 55, 80, 100]

interface Cell {
  key: string
  date: Date
  count: number
  level: number
  future: boolean
}

const root = ref<HTMLElement | null>(null)
const { width } = useElementSize(root)
const weekCount = computed(() =>
  width.value ? Math.max(1, Math.min(MAX_WEEKS, Math.floor((width.value - LABEL_WIDTH) / MIN_PITCH))) : MAX_WEEKS,
)

const today = startOfDay(new Date())
const firstDay = computed(() => addDays(today, -(today.getDay() + (weekCount.value - 1) * 7)))

const weeks = computed<Cell[][]>(() => {
  const days = Array.from({ length: weekCount.value * 7 }, (_, i) => addDays(firstDay.value, i))
  const max = Math.max(1, ...days.map((d) => props.activity[dayKey(d)] ?? 0))
  const cols: Cell[][] = []
  days.forEach((date, i) => {
    const key = dayKey(date)
    const count = props.activity[key] ?? 0
    const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4))
    ;(cols[Math.floor(i / 7)] ??= []).push({ key, date, count, level, future: date > today })
  })
  return cols
})

const monthLabels = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value, { month: 'short' })
  const labels: { col: number; label: string }[] = []
  weeks.value.forEach((week, col) => {
    const first = week.find((c) => c.date.getDate() === 1)
    if (first || col === 0) labels.push({ col, label: fmt.format((first ?? week[0]!).date) })
  })
  if (labels.length > 1 && labels[1]!.col - labels[0]!.col < 3) labels.shift()
  return labels
})

const weekdayLabels = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: 'short' })
  return [1, 3, 5].map((row) => ({ row, label: fmt.format(addDays(firstDay.value, row)) }))
})

function cellStyle(cell: Cell) {
  if (!cell.level) return undefined
  return { backgroundColor: `color-mix(in srgb, var(--accent) ${SHADES[cell.level]}%, transparent)` }
}

const dateFmt = computed(
  () => new Intl.DateTimeFormat(locale.value, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
)
function describe(cell: Cell): string {
  const date = dateFmt.value.format(cell.date)
  return cell.count
    ? t('progressStats.dayReviews', { count: cell.count, date }, cell.count)
    : t('progressStats.dayNone', { date })
}

const hovered = ref<Cell | null>(null)
</script>

<template>
  <div ref="root">
    <div class="overflow-hidden p-px pb-1">
      <div
        class="grid gap-0.75 text-[10px] leading-none text-neutral-400"
        :style="{ gridTemplateColumns: `auto repeat(${weekCount}, minmax(0, 1fr))` }"
        role="img"
        :aria-label="$t('progressStats.heatmapAlt')"
        @mouseleave="hovered = null"
      >
        <span
          v-for="m in monthLabels"
          :key="`m${m.col}`"
          class="w-0 pb-1 whitespace-nowrap"
          :style="{ gridColumn: m.col + 2, gridRow: 1 }"
          >{{ m.label }}</span
        >
        <span
          v-for="w in weekdayLabels"
          :key="`w${w.row}`"
          class="self-center pr-1.5"
          :style="{ gridColumn: 1, gridRow: w.row + 2 }"
          >{{ w.label }}</span
        >
        <template v-for="(week, col) in weeks" :key="col">
          <div
            v-for="(cell, row) in week"
            :key="cell.key"
            class="aspect-square rounded-[2px]"
            :class="[
              cell.future ? 'invisible' : cell.level ? '' : 'bg-neutral-200/70 dark:bg-neutral-800',
              hovered?.key === cell.key && 'ring-1 ring-neutral-500 dark:ring-neutral-300',
            ]"
            :style="{ gridColumn: col + 2, gridRow: row + 2, ...cellStyle(cell) }"
            :title="cell.future ? undefined : describe(cell)"
            @mouseenter="hovered = cell.future ? null : cell"
            @click="hovered = cell.future ? null : cell"
          />
        </template>
      </div>
    </div>

    <div class="mt-2 flex min-h-4 items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
      <p class="truncate" aria-live="polite">{{ hovered ? describe(hovered) : '' }}</p>
      <div class="flex shrink-0 items-center gap-1" aria-hidden="true">
        <span class="mr-0.5">{{ $t('progressStats.less') }}</span>
        <span class="size-2.5 rounded-[2px] bg-neutral-200/70 dark:bg-neutral-800" />
        <span
          v-for="level in [1, 2, 3, 4]"
          :key="level"
          class="size-2.5 rounded-[2px]"
          :style="{ backgroundColor: `color-mix(in srgb, var(--accent) ${SHADES[level]}%, transparent)` }"
        />
        <span class="ml-0.5">{{ $t('progressStats.more') }}</span>
      </div>
    </div>
  </div>
</template>
