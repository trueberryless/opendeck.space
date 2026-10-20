<script setup lang="ts">
const { keyshortcuts, lang, text } = defineProps<{ keyshortcuts?: string; lang?: string; text: string }>()

const { canSpeak, isSpeaking, stop, toggle } = useSpeech()
const speaking = computed(() => isSpeaking(text, lang))

onBeforeUnmount(() => {
  if (speaking.value) stop()
})
</script>

<template>
  <UButton
    v-if="canSpeak(lang) && text.trim()"
    :icon="speaking ? 'i-lucide-square' : 'i-lucide-volume-2'"
    color="neutral"
    variant="ghost"
    size="xs"
    class="shrink-0"
    :aria-label="speaking ? $t('speech.stop') : $t('speech.readAloud', { text })"
    :aria-keyshortcuts="keyshortcuts"
    @click.stop="toggle(text, lang)"
  />
</template>
