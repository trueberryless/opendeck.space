<script setup lang="ts">
import { challengeStatus, daysLeft } from '~/utils/challenges'
import type { ChallengeView } from '~/composables/useChallenges'

const props = defineProps<{ challenge: ChallengeView }>()
defineEmits<{ open: [challenge: ChallengeView] }>()

const status = computed(() => challengeStatus(props.challenge.value))
const left = computed(() => daysLeft(props.challenge.value))
</script>

<template>
  <button
    type="button"
    class="border-default hover:border-accent flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors"
    @click="$emit('open', challenge)"
  >
    <span
      class="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg"
      :class="status === 'ended' ? 'opacity-50' : ''"
      aria-hidden="true"
    >
      <UIcon
        :name="challenge.value.kind === 'everyDay' ? 'i-lucide-flame' : 'i-lucide-calendar-check'"
        class="size-5"
      />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate font-medium">{{ challenge.value.title }}</span>
      <span class="text-muted block text-xs">
        {{ $t(`challenges.kinds.${challenge.value.kind}`) }} ·
        {{ status === 'ended' ? $t('challenges.ended') : $t('challenges.daysLeft', { count: left }, left) }}
      </span>
    </span>
    <UIcon name="i-lucide-chevron-right" class="text-muted size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
  </button>
</template>
