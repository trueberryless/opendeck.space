<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ROUND_MS, type BattleView } from '~/utils/battle/game'

const props = defineProps<{ view: BattleView; viewAt: number; choice: number | null; me?: string; host?: string }>()
const emit = defineEmits<{ answer: [choice: number] }>()
const { t } = useI18n()

const now = ref(performance.now())
useRafFn(() => (now.value = performance.now()))

const remaining = computed(() =>
  props.view.phase === 'question' ? Math.max(0, props.view.remainingMs - (now.value - props.viewAt)) : 0,
)
const seconds = computed(() => Math.ceil(remaining.value / 1000))
const revealed = computed(() => props.view.phase === 'reveal')
const mine = computed(() => props.view.players.find((p) => p.did === props.me))
const locked = computed(() => revealed.value || props.choice !== null || remaining.value <= 0)

function optionClass(i: number) {
  if (revealed.value) {
    if (i === props.view.answer) return 'border-success bg-success/15 text-highlighted'
    if (i === props.choice) return 'border-error bg-error/10'
    return 'opacity-50'
  }
  return i === props.choice ? 'border-accent bg-accent' : 'hover:border-accent'
}

function result() {
  if (!revealed.value) return null
  if (props.choice === null) return 'timeUp'
  return props.choice === props.view.answer ? 'correct' : 'wrong'
}

useShortcuts(
  'battle',
  () => t('battle.title'),
  () =>
    (props.view.question?.options ?? []).map((_, i) => ({
      keys: [String(i + 1)],
      label: t('battle.pickOption', { n: i + 1 }),
      run: () => emit('answer', i),
      when: () => !locked.value,
      onInteractive: true,
    })),
)
</script>

<template>
  <div v-if="view.question" class="space-y-6">
    <div class="space-y-2">
      <div class="text-muted flex items-center justify-between text-sm">
        <span>{{ $t('battle.round', { current: view.round + 1, total: view.rounds }) }}</span>
        <span class="tabular-nums" aria-hidden="true">{{ seconds }}s</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <div class="bg-accent h-full rounded-full" :style="{ width: `${(remaining / ROUND_MS) * 100}%` }" />
      </div>
    </div>

    <div class="border-default rounded-2xl border p-8 text-center">
      <p class="text-3xl font-bold tracking-tight wrap-break-word">{{ view.question.prompt }}</p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <button
        v-for="(option, i) in view.question.options"
        :key="i"
        type="button"
        class="border-default flex items-center gap-3 rounded-xl border-2 p-4 text-start font-medium transition-colors disabled:cursor-default"
        :class="optionClass(i)"
        :disabled="locked"
        :aria-pressed="choice === i"
        :aria-keyshortcuts="String(i + 1)"
        @click="$emit('answer', i)"
      >
        <kbd class="text-muted font-sans text-xs" aria-hidden="true">{{ i + 1 }}</kbd>
        <span class="min-w-0 flex-1 wrap-break-word">{{ option }}</span>
        <UIcon v-if="revealed && i === view.answer" name="i-lucide-check" class="text-success size-5 shrink-0" />
      </button>
    </div>

    <p v-if="result()" class="text-center font-semibold" role="status">
      {{ $t(`battle.${result()}`) }}
      <span v-if="mine?.gained" class="text-success">+{{ mine.gained }}</span>
    </p>

    <BattlePlayers :players="view.players" :phase="view.phase" :me="me" :host="host" />
  </div>
</template>
