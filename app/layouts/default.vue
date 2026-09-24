<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const route = useRoute()
const centered = computed(() => route.meta.centered === true)
const fill = computed(() => route.meta.fill === true)
const { t } = useI18n()
const toast = useToast()

const main = ref<HTMLElement | null>(null)

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
  <div class="bg-default flex min-h-dvh flex-col text-neutral-900 dark:text-neutral-100">
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
    </ClientOnly>
  </div>
</template>
