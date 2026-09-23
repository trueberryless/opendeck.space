<script setup lang="ts">
const route = useRoute()
const isLoggedIn = useIsLoggedIn()
const items = computed(() => visibleNavItems(isLoggedIn.value))
</script>

<template>
  <header class="border-default sticky top-0 z-40 hidden border-b bg-(--ui-bg)/80 backdrop-blur md:block">
    <div class="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
      <NuxtLink to="/" class="flex items-center gap-2 font-semibold tracking-tight" aria-label="OpenDeck home">
        <Logo :size="26" />
        <span>OpenDeck</span>
      </NuxtLink>

      <div class="flex-1" />

      <nav class="flex items-center gap-1" aria-label="Primary">
        <UButton
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :label="$t(item.label)"
          :color="isNavActive(route.path, item.to) ? 'primary' : 'neutral'"
          :variant="isNavActive(route.path, item.to) ? 'soft' : 'ghost'"
          size="sm"
        />
        <UButton
          v-if="!isLoggedIn"
          to="/login"
          :label="$t('common.signIn')"
          icon="i-lucide-log-in"
          size="sm"
          :color="isNavActive(route.path, '/login') ? 'primary' : 'neutral'"
          :variant="isNavActive(route.path, '/login') ? 'soft' : 'ghost'"
        />
      </nav>

      <ThemeToggle />
    </div>
  </header>
</template>
