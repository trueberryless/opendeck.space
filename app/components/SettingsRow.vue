<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="border-default flex items-center justify-between gap-4 rounded-lg border p-4">
    <div class="min-w-0">
      <p class="font-medium">{{ title }}</p>
      <p v-if="description" class="text-sm text-neutral-500 dark:text-neutral-400">{{ description }}</p>
    </div>
    <USwitch v-model="model" />
  </div>
</template>
