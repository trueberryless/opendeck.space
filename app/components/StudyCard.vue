<script setup lang="ts">
import type { ReadingMode } from '~/utils/records'

const props = defineProps<{
  front: string
  back: string
  hint?: string
  promptReading?: string
  answerReading?: string
  readingMode?: ReadingMode
  examples?: string[]
  frontLang?: string
  backLang?: string
  did?: string
  image?: unknown
  imageAlt?: string
  audio?: unknown
  showHint: boolean
  revealed: boolean
}>()

const emit = defineEmits<{ revealHint: [] }>()

const mode = computed<ReadingMode>(() => props.readingMode ?? 'answer')
const promptReadingShown = computed(() => (mode.value === 'prompt' ? props.promptReading : undefined))
const answerReadingShown = computed(() => (mode.value === 'answer' ? props.answerReading : undefined))
const hintText = computed(() => {
  const parts = [props.hint]
  if (mode.value === 'hint' && props.promptReading) parts.push(props.promptReading)
  return parts.filter(Boolean).join(' · ')
})
</script>

<template>
  <div
    class="border-default bg-muted flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border p-8 text-center select-none"
  >
    <CardMedia v-if="did && image" :did="did" :image="image" :image-alt="imageAlt" class="mb-4 w-full" />

    <p class="text-2xl font-semibold text-balance" :lang="langAttr(frontLang)">{{ front }}</p>
    <p v-if="promptReadingShown" class="text-muted mt-1 text-sm">{{ promptReadingShown }}</p>

    <div v-if="hintText && !revealed" class="mt-3" aria-live="polite">
      <p v-if="showHint" class="text-muted text-sm">{{ hintText }}</p>
      <button
        v-else
        type="button"
        class="hover:text-accent text-muted min-h-6 rounded px-2 py-1 text-xs underline"
        aria-keyshortcuts="H"
        @click.stop="emit('revealHint')"
      >
        {{ $t('study.showHint') }}
      </button>
    </div>

    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="translate-y-1 opacity-0">
      <div v-if="revealed" class="mt-6 w-full space-y-3">
        <hr class="border-default" aria-hidden="true" />
        <p class="text-xl text-balance" :lang="langAttr(backLang)">{{ back }}</p>
        <p v-if="answerReadingShown" class="text-muted text-sm">{{ answerReadingShown }}</p>
        <CardMedia v-if="did && audio" :did="did" :audio="audio" class="w-full" />
        <ul v-if="examples?.length" class="text-muted space-y-1 text-sm">
          <li v-for="(ex, i) in examples" :key="i">“{{ ex }}”</li>
        </ul>
      </div>
    </Transition>

    <p v-if="!revealed" class="text-muted mt-6 text-xs">{{ $t('study.revealHelp') }}</p>
  </div>
</template>
