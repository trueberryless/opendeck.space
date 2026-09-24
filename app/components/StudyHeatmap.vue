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
    ? t('progressStats.dayRepetitions', { count: cell.count, date }, cell.count)
    : t('progressStats.dayNone', { date })
}

const hovered = ref<Cell | null>(null)
const liveId = useId()

useShortcuts(
  'activity',
  () => t('shortcuts.groups.activity'),
  () => [
    { keys: ['arrowleft+arrowright+arrowup+arrowdown'], label: t('shortcuts.moveDays') },
    { keys: ['home', 'end'], label: t('shortcuts.firstLastDay') },
  ],
)

const pastCells = computed(() => weeks.value.flat().filter((c) => !c.future))

function cellFromEvent(event: Event): Cell | null {
  const key = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-day]')?.dataset.day
  return pastCells.value.find((c) => c.key === key) ?? null
}

function onFocus() {
  if (!hovered.value) hovered.value = pastCells.value.at(-1) ?? null
}

function onKeydown(event: KeyboardEvent) {
  const cells = pastCells.value
  if (cells.length === 0) return
  const rtl = getComputedStyle(event.currentTarget as HTMLElement).direction === 'rtl'
  const steps: Record<string, number> = {
    ArrowUp: -1,
    ArrowDown: 1,
    ArrowLeft: rtl ? 7 : -7,
    ArrowRight: rtl ? -7 : 7,
  }
  const index = Math.max(
    0,
    cells.findIndex((c) => c.key === hovered.value?.key),
  )
  let next: number
  if (event.key in steps) next = index + steps[event.key]!
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = cells.length - 1
  else return
  event.preventDefault()
  hovered.value = cells[Math.min(cells.length - 1, Math.max(0, next))]!
}
</script>

<template>
  <div ref="root">
    <div class="overflow-hidden p-px pb-1">
      <div
        class="text-muted grid gap-0.75 rounded-sm text-[10px] leading-none"
        :style="{ gridTemplateColumns: `auto repeat(${weekCount}, minmax(0, 1fr))` }"
        role="group"
        tabindex="0"
        :aria-label="$t('progressStats.heatmapAlt')"
        :aria-describedby="liveId"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
        @mouseleave="hovered = null"
        @focus="onFocus"
        @keydown="onKeydown"
        @click="hovered = cellFromEvent($event) ?? hovered"
      >
        <span
          v-for="m in monthLabels"
          :key="`m${m.col}`"
          class="w-0 pb-1 whitespace-nowrap"
          aria-hidden="true"
          :style="{ gridColumn: m.col + 2, gridRow: 1 }"
          >{{ m.label }}</span
        >
        <span
          v-for="w in weekdayLabels"
          :key="`w${w.row}`"
          class="self-center pe-1.5"
          aria-hidden="true"
          :style="{ gridColumn: 1, gridRow: w.row + 2 }"
          >{{ w.label }}</span
        >
        <template v-for="(week, col) in weeks" :key="col">
          <div
            v-for="(cell, row) in week"
            :key="cell.key"
            :data-day="cell.future ? undefined : cell.key"
            aria-hidden="true"
            class="aspect-square rounded-[2px]"
            :class="[
              cell.future ? 'invisible' : cell.level ? '' : 'bg-neutral-200/70 dark:bg-neutral-800',
              hovered?.key === cell.key && 'ring-2 ring-(--ui-text-highlighted)',
            ]"
            :style="{ gridColumn: col + 2, gridRow: row + 2, ...cellStyle(cell) }"
            :title="cell.future ? undefined : describe(cell)"
            @mouseenter="hovered = cell.future ? null : cell"
          />
        </template>
      </div>
    </div>

    <div class="text-muted mt-2 flex min-h-4 items-center justify-between gap-3 text-xs">
      <p :id="liveId" class="truncate" aria-live="polite">{{ hovered ? describe(hovered) : '' }}</p>
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
