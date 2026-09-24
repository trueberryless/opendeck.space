<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <UTooltip :text="title">
    <span class="text-accent inline-flex items-center gap-1 text-xs font-medium" tabindex="0">
      <UIcon name="i-lucide-badge-check" class="size-3.5" aria-hidden="true" />
      {{ $t('starter.verified') }}
      <span class="sr-only">: {{ title }}</span>
    </span>
  </UTooltip>
</template>
