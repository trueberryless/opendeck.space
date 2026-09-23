<script setup lang="ts">
const emit = defineEmits<{ edit: []; delete: [] }>()
</script>

<template>
  <div class="flex shrink-0 gap-1">
    <UButton
      icon="i-lucide-pencil"
      color="neutral"
      variant="ghost"
      size="xs"
      :aria-label="$t('deck.editCardTitle')"
      @click="emit('edit')"
    />
    <ConfirmPopover :title="$t('deck.confirmDeleteCard')" @confirm="emit('delete')">
      <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :aria-label="$t('common.delete')" />
    </ConfirmPopover>
  </div>
</template>
