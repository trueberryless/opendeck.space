<script setup lang="ts">
const { online, pending } = useSync()
const route = useRoute()
const showSyncing = computed(() => pending.value > 0 && route.meta.inlineSync !== true)
</script>

<template>
  <ClientOnly>
    <div
      v-if="!online || showSyncing"
      class="border-default bg-muted text-muted border-b px-4 py-1.5 text-center text-xs"
      role="status"
    >
      <span v-if="!online" class="inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-cloud-off" class="size-3.5" />
        {{ $t('offline.message') }}
      </span>
      <span v-else class="inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-refresh-cw" class="size-3.5 animate-spin" />
        {{ $t('offline.syncing', { count: pending }, pending) }}
      </span>
    </div>
  </ClientOnly>
</template>
