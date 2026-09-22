<script setup lang="ts">
import type { CardView } from '~/composables/useDecks'
import type { ProgressState } from '~/utils/fsrs'

export type StateColor = 'neutral' | 'warning' | 'success' | 'error'

const props = defineProps<{
  cards: CardView[]
  did: string
  isOwner: boolean
  loggedIn: boolean
  reversed?: boolean
  stateOf: (card: CardView) => ProgressState
  stateMeta: Record<ProgressState, { label: string; color: StateColor }>
}>()

const emit = defineEmits<{ edit: [CardView]; delete: [CardView] }>()

function primary(card: CardView): string {
  return props.reversed ? card.value.back : card.value.front
}
function primaryReading(card: CardView): string | undefined {
  return props.reversed ? card.value.phonetic : card.value.phoneticFront
}
function secondary(card: CardView): string {
  return props.reversed ? card.value.front : card.value.back
}
function secondaryReading(card: CardView): string | undefined {
  return props.reversed ? card.value.phoneticFront : card.value.phonetic
}
</script>

<template>
  <ul class="divide-default border-default divide-y overflow-hidden rounded-lg border">
    <li v-for="card in cards" :key="card.rkey" class="flex items-start gap-4 p-4">
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-medium wrap-break-word">{{ primary(card) }}</p>
          <UBadge
            v-if="loggedIn"
            :label="stateMeta[stateOf(card)].label"
            :color="stateMeta[stateOf(card)].color"
            variant="subtle"
            size="sm"
          />
        </div>
        <p v-if="primaryReading(card)" class="text-xs text-neutral-400">{{ primaryReading(card) }}</p>
        <p class="text-sm wrap-break-word text-neutral-500 dark:text-neutral-400">{{ secondary(card) }}</p>
        <p v-if="secondaryReading(card)" class="text-xs text-neutral-400">{{ secondaryReading(card) }}</p>
        <CardMedia
          v-if="card.value.image || card.value.audio"
          :did="did"
          :image="card.value.image"
          :image-alt="card.value.imageAlt"
          :audio="card.value.audio"
          class="max-w-xs"
        />
      </div>
      <div v-if="isOwner" class="flex shrink-0 gap-1">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="$t('deck.editCardTitle')"
          @click="emit('edit', card)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          :aria-label="$t('common.delete')"
          @click="emit('delete', card)"
        />
      </div>
    </li>
  </ul>
</template>
