<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const route = useRoute()
const centered = computed(() => route.meta.centered === true)
const fill = computed(() => route.meta.fill === true)
const { t } = useI18n()
const toast = useToast()

const main = ref<HTMLElement | null>(null)
const backdrop = usePageBackdrop()

function skipToContent(event: MouseEvent) {
  event.preventDefault()
  main.value?.focus()
  main.value?.scrollIntoView({ block: 'start' })
}

onMounted(() => {
  try {
    if (sessionStorage.getItem(DATA_DELETED_KEY) !== '1') return
    sessionStorage.removeItem(DATA_DELETED_KEY)
  } catch {
    return
  }
  toast.add({
    title: t('settings.deleteAllDone'),
    description: t('settings.deleteAllDoneBody'),
    color: 'success',
    icon: 'i-lucide-circle-check',
    duration: 10000,
  })
})
</script>

<template>
  <div
    class="bg-default isolate flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-neutral-900 md:pt-0 dark:text-neutral-100"
  >
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-(--ui-bg) md:hidden"
      aria-hidden="true"
    />
    <TierBackdrop v-if="backdrop" :tier="backdrop.tier" :role="backdrop.role" />
    <a href="#main-content" class="skip-link" @click="skipToContent">{{ $t('a11y.skipToContent') }}</a>
    <AppHeader />
    <OfflineBanner />
    <InstallBanner />
    <TranslationBanner />

    <main
      id="main-content"
      ref="main"
      tabindex="-1"
      class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-6 pb-24 focus:outline-none md:pb-6"
    >
      <div :class="centered ? 'my-auto w-full' : fill ? 'flex w-full flex-1 flex-col' : 'w-full'">
        <slot />
      </div>
    </main>

    <AppFooter />
    <AppBottomNav />
    <ClientOnly>
      <KeyboardShortcuts />
      <TierCelebration />
    </ClientOnly>
  </div>
</template>
