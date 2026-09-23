<script setup lang="ts">
const { showBanner, dismiss } = useInstallApp()
</script>

<template>
  <ClientOnly>
    <div
      v-if="showBanner"
      class="border-default bg-muted border-b px-4 py-2 md:hidden"
      role="region"
      :aria-label="$t('install.title')"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-3">
        <img src="/pwa-192x192.png" alt="" class="size-9 shrink-0 rounded-lg" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">{{ $t('install.title') }}</p>
          <p class="truncate text-xs text-neutral-500 dark:text-neutral-400">{{ $t('install.body') }}</p>
        </div>
        <InstallAppButton size="sm" />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="$t('install.dismiss')"
          @click="dismiss"
        />
      </div>
    </div>
  </ClientOnly>
</template>
