<script setup lang="ts">
const props = defineProps<{ title: string; description?: string; confirmLabel?: string; disabled?: boolean }>()
const emit = defineEmits<{ confirm: [] }>()
const open = ref(false)
const titleId = useId()
const descriptionId = useId()
const content = computed(() => ({
  align: 'end' as const,
  side: 'bottom' as const,
  sideOffset: 6,
  role: 'alertdialog',
  'aria-labelledby': titleId,
  'aria-describedby': props.description ? descriptionId : undefined,
}))

function onConfirm() {
  open.value = false
  emit('confirm')
}
</script>

<template>
  <UPopover v-model:open="open" :disabled="props.disabled" :content="content">
    <slot />
    <template #content>
      <div class="w-72 max-w-[calc(100vw-2rem)] space-y-3 p-4">
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-triangle-alert" class="text-error mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div class="min-w-0 space-y-1">
            <p :id="titleId" class="text-sm font-medium">{{ props.title }}</p>
            <p v-if="props.description" :id="descriptionId" class="text-muted text-sm">
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
