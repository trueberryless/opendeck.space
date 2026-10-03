<script setup lang="ts">
const { keyshortcuts, lang, text } = defineProps<{ keyshortcuts?: string; lang?: string; text: string }>()

const { canSpeak, status, stop, toggle } = useSpeech()
const state = computed(() => status(text, lang))
const icon = computed(() => {
  if (state.value === 'pending') return 'i-lucide-loader-circle'
  return state.value === 'speaking' ? 'i-lucide-square' : 'i-lucide-volume-2'
})

onBeforeUnmount(() => {
  if (state.value !== 'idle') stop()
})
</script>

<template>
  <UButton
    v-if="canSpeak(lang) && text.trim()"
    :icon="icon"
    color="neutral"
    variant="ghost"
    size="xs"
    class="shrink-0"
    :ui="{ leadingIcon: state === 'pending' ? 'motion-safe:animate-spin' : '' }"
    :aria-label="state === 'idle' ? $t('speech.readAloud', { text }) : $t('speech.stop')"
    :aria-keyshortcuts="keyshortcuts"
    @click.stop="toggle(text, lang)"
  />
</template>
