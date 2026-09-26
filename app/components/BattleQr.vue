<script setup lang="ts">
import { renderSVG } from 'uqr'

const props = defineProps<{ url: string; label: string }>()
const svg = computed(() => renderSVG(props.url, { border: 2 }))
</script>

<template>
  <div
    class="aspect-square w-full max-w-56 overflow-hidden rounded-xl bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
    role="img"
    :aria-label="label"
    v-html="svg"
  />
</template>
