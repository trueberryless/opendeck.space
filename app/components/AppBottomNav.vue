<script setup lang="ts">
const route = useRoute()
const isLoggedIn = useIsLoggedIn()

const items = computed(() => {
  const nav = visibleNavItems(isLoggedIn.value)
  return isLoggedIn.value ? nav : [...nav, { label: 'Sign in', to: '/login', icon: 'i-lucide-log-in' }]
})

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <nav
    class="border-default fixed inset-x-0 bottom-0 z-40 border-t bg-(--ui-bg)/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    aria-label="Primary"
  >
    <ul class="mx-auto flex max-w-lg items-stretch justify-around">
      <li v-for="item in items" :key="item.to" class="flex-1">
        <NuxtLink
          :to="item.to"
          class="flex flex-col items-center gap-1 py-2 text-xs transition-colors"
          :class="isActive(item.to) ? 'text-accent' : 'text-neutral-500 dark:text-neutral-400'"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <UIcon :name="item.icon" class="size-5" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
