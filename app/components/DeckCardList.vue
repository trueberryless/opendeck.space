<script setup lang="ts">
import type { CardView } from '~/composables/useDecks'
import type { ProgressState } from '~/utils/fsrs'

export type StateColor = 'neutral' | 'warning' | 'success' | 'error'

defineProps<{
  cards: CardView[]
  did: string
  isOwner: boolean
  loggedIn: boolean
  stateOf: (card: CardView) => ProgressState
  stateMeta: Record<ProgressState, { label: string; color: StateColor }>
}>()

const emit = defineEmits<{ edit: [CardView]; delete: [CardView] }>()
</script>

<template>
  <ul class="divide-default border-default divide-y overflow-hidden rounded-lg border">
    <li v-for="card in cards" :key="card.rkey" class="flex items-start gap-4 p-4">
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-medium wrap-break-word">{{ card.value.front }}</p>
          <UBadge
            v-if="loggedIn"
            :label="stateMeta[stateOf(card)].label"
            :color="stateMeta[stateOf(card)].color"
            variant="subtle"
            size="sm"
          />
        </div>
        <p class="text-sm wrap-break-word text-neutral-500 dark:text-neutral-400">{{ card.value.back }}</p>
        <p v-if="card.value.phonetic" class="text-xs text-neutral-400">{{ card.value.phonetic }}</p>
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
