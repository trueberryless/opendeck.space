<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { balanceHint } from '~/utils/tiers'

const { locale } = useI18n()
const { today, breakReminders } = useMotivation()

const hint = computed(() => (breakReminders.value ? balanceHint(today.value) : null))
const time = computed(() => formatStudyTime(today.value?.activeSeconds ?? 0, locale.value))
</script>

<template>
  <UAlert
    v-if="hint"
    icon="i-lucide-coffee"
    color="neutral"
    variant="subtle"
    :description="hint === 'plenty' ? $t('balance.plenty', { time }) : $t('balance.manyNew')"
  />
</template>
