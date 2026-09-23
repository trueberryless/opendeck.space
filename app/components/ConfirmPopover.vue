<script setup lang="ts">
const props = defineProps<{ title: string; description?: string; confirmLabel?: string; disabled?: boolean }>()
const emit = defineEmits<{ confirm: [] }>()
const open = ref(false)

function onConfirm() {
  open.value = false
  emit('confirm')
}
</script>

<template>
  <UPopover v-model:open="open" :disabled="props.disabled" :content="{ align: 'end', side: 'bottom', sideOffset: 6 }">
    <slot />
    <template #content>
      <div class="w-72 max-w-[calc(100vw-2rem)] space-y-3 p-4" role="alertdialog" :aria-label="props.title">
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-triangle-alert" class="text-error mt-0.5 size-4 shrink-0" />
          <div class="min-w-0 space-y-1">
            <p class="text-sm font-medium">{{ props.title }}</p>
            <p v-if="props.description" class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ props.description }}
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" size="sm" @click="open = false" />
          <UButton :label="props.confirmLabel ?? $t('common.delete')" color="error" size="sm" @click="onConfirm" />
        </div>
      </div>
    </template>
  </UPopover>
</template>
