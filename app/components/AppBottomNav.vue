<script setup lang="ts">
const route = useRoute()
const isLoggedIn = useIsLoggedIn()

const items = computed(() => {
  const nav = visibleNavItems(isLoggedIn.value)
  return isLoggedIn.value ? nav : [...nav, { label: 'common.signIn', to: '/login', icon: 'i-lucide-log-in' }]
})
</script>

<template>
  <nav
    class="border-default fixed inset-x-0 bottom-0 z-40 border-t bg-(--ui-bg)/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    :aria-label="$t('a11y.mainNav')"
  >
    <ul class="mx-auto flex max-w-lg items-stretch justify-around">
      <li v-for="item in items" :key="item.to" class="flex-1">
        <NuxtLink
          :to="item.to"
          class="flex flex-col items-center gap-1 py-2 text-xs transition-colors"
          :class="isNavActive(route.path, item.to) ? 'text-accent' : 'text-muted'"
          :aria-current="isNavActive(route.path, item.to) ? 'page' : undefined"
        >
          <UIcon :name="item.icon" class="size-5" aria-hidden="true" />
          <span>{{ $t(item.label) }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
