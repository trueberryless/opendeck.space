<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ title: string; description?: string; disabled?: boolean }>()
const id = useId()
</script>

<template>
  <div class="border-default flex items-center justify-between gap-4 rounded-lg border p-4">
    <div class="min-w-0">
      <label :for="id" class="font-medium">{{ title }}</label>
      <p v-if="description" :id="`${id}-description`" class="text-muted text-sm">{{ description }}</p>
    </div>
    <USwitch
      :id="id"
      v-model="model"
      :disabled="disabled"
      :aria-describedby="description ? `${id}-description` : undefined"
    />
  </div>
</template>
