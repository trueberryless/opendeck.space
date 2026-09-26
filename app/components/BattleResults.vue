<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { BattleView } from '~/utils/battle/game'

const props = defineProps<{ view: BattleView; isHost: boolean; me?: string }>()
defineEmits<{ again: []; close: [] }>()
const { t, locale } = useI18n()

const ranking = computed(() => [...props.view.players].sort((a, b) => b.score - a.score))
const top = computed(() => ranking.value[0]?.score ?? 0)
const winners = computed(() => ranking.value.filter((p) => p.score === top.value))
const headline = computed(() =>
  winners.value.length > 1 ? t('battle.draw') : t('battle.winner', { name: winners.value[0]?.name ?? '' }),
)
const particles = Array.from({ length: 12 }, (_, i) => ({ '--angle': `${i * 30}deg`, '--delay': `${(i % 4) * 0.18}s` }))
const format = computed(() => new Intl.NumberFormat(locale.value))
</script>

<template>
  <div class="space-y-6 text-center">
    <div class="tier-gold relative mx-auto flex size-40 items-center justify-center" aria-hidden="true">
      <div class="tier-rays absolute inset-0" />
      <UIcon
        v-for="(style, i) in particles"
        :key="i"
        name="i-lucide-star"
        class="tier-particle size-4"
        :style="style"
      />
      <div class="tier-gradient tier-pop flex size-20 items-center justify-center rounded-3xl text-neutral-950">
        <UIcon name="i-lucide-trophy" class="size-10" />
      </div>
    </div>
    <div class="tier-rise-in space-y-1">
      <p class="text-muted text-xs font-medium tracking-wide uppercase">{{ $t('battle.results') }}</p>
      <h2 class="text-2xl font-bold tracking-tight" role="status">{{ headline }}</h2>
    </div>

    <ol class="divide-default border-default mx-auto max-w-md divide-y overflow-hidden rounded-xl border text-start">
      <li
        v-for="(player, i) in ranking"
        :key="player.did"
        class="flex items-center gap-3 p-3"
        :class="player.did === me ? 'bg-(--ui-bg-muted)' : ''"
      >
        <span class="w-5 text-center font-semibold tabular-nums">{{ i + 1 }}</span>
        <UAvatar :src="player.avatar" :alt="player.name" size="sm" />
        <span class="min-w-0 flex-1 truncate font-medium">{{ player.name }}</span>
        <span v-if="player.multiplier > 1" class="text-accent text-xs font-semibold">×{{ player.multiplier }}</span>
        <span class="font-semibold tabular-nums">{{ format.format(player.score) }}</span>
      </li>
    </ol>

    <div class="flex flex-wrap justify-center gap-2">
      <template v-if="isHost">
        <UButton :label="$t('battle.again')" icon="i-lucide-rotate-ccw" @click="$emit('again')" />
        <UButton :label="$t('battle.close')" color="neutral" variant="subtle" @click="$emit('close')" />
      </template>
      <UButton v-else :label="$t('battle.leave')" color="neutral" variant="subtle" @click="$emit('close')" />
    </div>
  </div>
</template>
