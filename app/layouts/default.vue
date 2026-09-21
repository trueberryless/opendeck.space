<script setup lang="ts">
const route = useRoute()
const centered = computed(() => route.meta.centered === true)
</script>

<template>
  <div class="bg-default flex min-h-dvh flex-col text-neutral-900 dark:text-neutral-100">
    <AppHeader />
    <OfflineBanner />

    <!-- Bottom padding on mobile leaves room for the fixed tab bar. -->
    <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-6 pb-24 md:pb-6">
      <div :class="centered ? 'my-auto w-full' : 'w-full'">
        <slot />
      </div>
    </main>

    <AppFooter />
    <AppBottomNav />
  </div>
</template>
