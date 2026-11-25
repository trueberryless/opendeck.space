<script setup lang="ts">
import type { Practice } from '~/composables/usePractice'

const { keyshortcuts, practice } = defineProps<{ keyshortcuts?: string; practice: Practice }>()

const recording = computed(() => practice.recorder.state.value !== 'idle')
</script>

<template>
  <UButton
    v-if="practice.recorder.supported.value && practice.current.value.text.trim()"
    :icon="recording ? 'i-lucide-square' : 'i-lucide-mic'"
    :color="recording ? 'error' : 'neutral'"
    variant="ghost"
    size="xs"
    class="shrink-0"
    :aria-label="
      recording ? $t('practice.stopRecording') : $t('practice.record', { text: practice.current.value.text })
    "
    :aria-keyshortcuts="keyshortcuts"
    @click.stop="practice.record()"
  />
</template>
