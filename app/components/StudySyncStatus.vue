<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { online, pending, syncFailed, flush } = useSync()
const { t } = useI18n()

const status = computed(() => {
  if (!online.value) return 'offline'
  if (pending.value === 0) return 'saved'
  return syncFailed.value ? 'failed' : 'syncing'
})
const label = computed(() => {
  if (status.value === 'offline') return t('offline.message')
  if (status.value === 'failed') return t('study.syncRetrying')
  if (status.value === 'syncing') return t('offline.syncing', { count: pending.value }, pending.value)
  return t('study.synced')
})
const icon = computed(
  () =>
    ({
      offline: 'i-lucide-cloud-off',
      saved: 'i-lucide-cloud-check',
      syncing: 'i-lucide-refresh-cw',
      failed: 'i-lucide-cloud-alert',
    })[status.value],
)
</script>

<template>
  <ClientOnly>
    <UTooltip :text="label">
      <UButton
        :icon="icon"
        :color="status === 'failed' ? 'warning' : 'neutral'"
        variant="ghost"
        size="sm"
        :aria-label="label"
        :ui="{ leadingIcon: status === 'syncing' ? 'animate-spin opacity-60' : status === 'saved' ? 'opacity-40' : '' }"
        @click="flush()"
      />
    </UTooltip>
  </ClientOnly>
</template>
