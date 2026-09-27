<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { flush } = useSync()
const { status: syncStatus, icon, syncing, detail } = useSyncStatus()
const route = useRoute()
const { t } = useI18n()

const status = computed(() =>
  route.meta.inlineSync === true || syncStatus.value === 'saved' ? null : syncStatus.value,
)
const label = computed(() => (status.value === 'offline' ? t('offline.short') : syncing.value))

function onOpen(open: boolean) {
  if (open && status.value === 'failed') void flush()
}
</script>

<template>
  <ClientOnly>
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <UPopover v-if="status" :content="{ side: 'top', sideOffset: 6 }" @update:open="onOpen">
        <button
          type="button"
          class="border-default text-muted inline-flex items-center gap-1.5 rounded-full border bg-(--ui-bg)/90 px-2.5 py-1 text-xs whitespace-nowrap shadow-sm backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
          :class="status === 'failed' ? 'text-warning' : ''"
          role="status"
          :aria-label="detail"
        >
          <UIcon :name="icon" class="size-3.5" :class="status === 'syncing' ? 'animate-spin' : ''" aria-hidden="true" />
          <span>{{ label }}</span>
        </button>
        <template #content>
          <p class="max-w-64 p-3 text-sm">{{ detail }}</p>
        </template>
      </UPopover>
    </Transition>
  </ClientOnly>
</template>
