<script setup lang="ts">
const { online, pending } = useSync()
</script>

<template>
  <ClientOnly>
    <div
      v-if="!online || pending > 0"
      class="border-default bg-muted border-b px-4 py-1.5 text-center text-xs text-neutral-500 dark:text-neutral-400"
      role="status"
    >
      <span v-if="!online" class="inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-cloud-off" class="size-3.5" />
        Offline. Your progress is saved locally and syncs when you reconnect.
      </span>
      <span v-else class="inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-refresh-cw" class="size-3.5 animate-spin" />
        Syncing {{ pending }} update{{ pending === 1 ? '' : 's' }}…
      </span>
    </div>
  </ClientOnly>
</template>
