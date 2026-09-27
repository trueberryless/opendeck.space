<script setup lang="ts">
const { flush } = useSync()
const { status, icon, detail: label } = useSyncStatus()
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
