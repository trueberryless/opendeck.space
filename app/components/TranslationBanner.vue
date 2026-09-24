<script setup lang="ts">
const { current } = useLocale()
const route = useRoute()
const dismissed = useLocalStorage<string[]>(TRANSLATION_NOTICE_KEY, [])

const show = computed(
  () =>
    !isUiChecked(current.value) &&
    !dismissed.value.includes(current.value) &&
    !route.path.startsWith('/translations') &&
    !route.path.startsWith('/study'),
)

function dismiss() {
  dismissed.value = [...dismissed.value, current.value]
}
</script>

<template>
  <ClientOnly>
    <div
      v-if="show"
      class="border-default bg-muted border-b px-4 py-2"
      role="region"
      :aria-label="$t('translations.title')"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-3">
        <UIcon name="i-lucide-languages" class="text-muted size-4 shrink-0" aria-hidden="true" />
        <p class="min-w-0 flex-1 text-xs">
          {{ uiVerifications(current).length ? $t('translations.bannerPartial') : $t('translations.banner') }}
          <NuxtLink
            to="/translations"
            class="font-medium text-(--accent) underline underline-offset-4 hover:opacity-80"
          >
            {{ $t('translations.bannerAction') }}
          </NuxtLink>
        </p>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="$t('translations.bannerDismiss')"
          @click="dismiss"
        />
      </div>
    </div>
  </ClientOnly>
</template>
