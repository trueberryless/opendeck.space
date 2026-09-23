<script setup lang="ts">
import type { ProgressState } from '~/utils/records'
import type { CardView } from '~/composables/useDecks'

export type StateColor = 'neutral' | 'warning' | 'success' | 'error'
export type CardListLayout = 'list' | 'dense' | 'grid'

const props = defineProps<{
  cards: CardView[]
  did: string
  isOwner: boolean
  loggedIn: boolean
  reversed?: boolean
  layout?: CardListLayout
  stateOf: (card: CardView) => ProgressState
  stateMeta: Record<ProgressState, { label: string; color: StateColor }>
}>()

const emit = defineEmits<{ edit: [CardView]; delete: [CardView] }>()

const DOT_CLASS: Record<StateColor, string> = {
  neutral: 'bg-neutral-400',
  warning: 'bg-warning',
  success: 'bg-success',
  error: 'bg-error',
}

function primary(card: CardView): string {
  return props.reversed ? card.value.back : card.value.front
}
function primaryReading(card: CardView): string | undefined {
  return props.reversed ? card.value.backReading : card.value.frontReading
}
function secondary(card: CardView): string {
  return props.reversed ? card.value.front : card.value.back
}
function secondaryReading(card: CardView): string | undefined {
  return props.reversed ? card.value.frontReading : card.value.backReading
}
</script>

<template>
  <ul
    v-if="layout === 'dense'"
    class="divide-default border-default divide-y overflow-hidden rounded-lg border text-sm"
  >
    <li v-for="card in cards" :key="card.rkey" class="flex min-h-10 items-center gap-2 px-3 py-1">
      <span
        v-if="loggedIn"
        class="size-2 shrink-0 rounded-full"
        :class="DOT_CLASS[stateMeta[stateOf(card)].color]"
        :title="stateMeta[stateOf(card)].label"
        role="img"
        :aria-label="stateMeta[stateOf(card)].label"
      />
      <div class="grid min-w-0 flex-1 grid-cols-[2fr_3fr] gap-3">
        <p class="truncate font-medium" :title="primary(card)">
          {{ primary(card) }}
          <span v-if="primaryReading(card)" class="text-xs font-normal text-neutral-400">
            {{ primaryReading(card) }}
          </span>
        </p>
        <p class="truncate text-neutral-500 dark:text-neutral-400" :title="secondary(card)">
          {{ secondary(card) }}
          <span v-if="secondaryReading(card)" class="text-xs text-neutral-400">{{ secondaryReading(card) }}</span>
        </p>
      </div>
      <UIcon v-if="card.value.image" name="i-lucide-image" class="size-3.5 shrink-0 text-neutral-400" />
      <UIcon v-if="card.value.audio" name="i-lucide-volume-2" class="size-3.5 shrink-0 text-neutral-400" />
      <DeckCardActions v-if="isOwner" @edit="emit('edit', card)" @delete="emit('delete', card)" />
    </li>
  </ul>

  <ul v-else-if="layout === 'grid'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <li v-for="card in cards" :key="card.rkey" class="border-default rounded-lg border p-3">
      <div class="flex items-start justify-between gap-2">
        <p class="font-medium wrap-break-word">{{ primary(card) }}</p>
        <UBadge
          v-if="loggedIn"
          :label="stateMeta[stateOf(card)].label"
          :color="stateMeta[stateOf(card)].color"
          variant="subtle"
          size="sm"
          class="shrink-0"
        />
      </div>
      <p v-if="primaryReading(card)" class="mt-1 text-xs text-neutral-400">{{ primaryReading(card) }}</p>
      <p class="mt-1 text-sm wrap-break-word text-neutral-500 dark:text-neutral-400">{{ secondary(card) }}</p>
      <p v-if="secondaryReading(card)" class="text-xs text-neutral-400">{{ secondaryReading(card) }}</p>
      <CardMedia
        v-if="card.value.image || card.value.audio"
        :did="did"
        :image="card.value.image"
        :image-alt="card.value.imageAlt"
        :audio="card.value.audio"
        class="mt-2"
      />
      <DeckCardActions v-if="isOwner" class="mt-2" @edit="emit('edit', card)" @delete="emit('delete', card)" />
    </li>
  </ul>

  <ul v-else class="divide-default border-default divide-y overflow-hidden rounded-lg border">
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
      <DeckCardActions v-if="isOwner" @edit="emit('edit', card)" @delete="emit('delete', card)" />
    </li>
  </ul>
</template>
