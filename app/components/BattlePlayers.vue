<script setup lang="ts">
import type { Phase, PlayerView } from '~/utils/battle/game'

const props = defineProps<{ players: PlayerView[]; phase: Phase; me?: string; host?: string }>()

const sorted = computed(() =>
  props.phase === 'lobby' ? props.players : [...props.players].sort((a, b) => b.score - a.score),
)
</script>

<template>
  <ul class="flex flex-wrap gap-2">
    <li
      v-for="player in sorted"
      :key="player.did"
      class="border-default flex min-w-0 items-center gap-2 rounded-full border py-1 ps-1 pe-3"
      :class="player.did === me ? 'ring-accent ring-2' : ''"
    >
      <UAvatar :src="player.avatar" :alt="player.name" size="xs" />
      <span class="max-w-32 truncate text-sm font-medium">{{ player.name }}</span>
      <UIcon
        v-if="player.did === host"
        name="i-lucide-crown"
        class="text-muted size-3.5 shrink-0"
        :aria-label="$t('battle.host')"
      />
      <TierBadge v-if="player.tier" :tier="player.tier" size="sm" />
      <span v-if="player.multiplier > 1" class="text-accent text-xs font-semibold tabular-nums">
        ×{{ player.multiplier }}
      </span>
      <span v-if="phase !== 'lobby'" class="text-sm tabular-nums">{{ player.score }}</span>
      <UIcon
        v-if="phase === 'question' && player.answered"
        name="i-lucide-circle-check"
        class="text-accent size-4 shrink-0"
        :aria-label="$t('battle.answered')"
      />
      <span
        v-if="phase === 'reveal' && player.gained !== null"
        class="text-xs font-semibold tabular-nums"
        :class="player.gained > 0 ? 'text-success' : 'text-muted'"
      >
        +{{ player.gained }}
      </span>
    </li>
  </ul>
</template>
