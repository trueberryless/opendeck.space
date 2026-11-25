<script setup lang="ts">
const { lang, readings, text } = defineProps<{ lang?: string; readings?: (string | undefined)[]; text: string }>()

const practice = usePractice(() => ({ text, lang, readings }))
const recording = computed(() => practice.recorder.state.value !== 'idle')
</script>

<template>
  <div class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-3">
    <div class="flex items-center gap-2">
      <p class="min-w-0 flex-1 font-medium wrap-break-word" :lang="langAttr(lang)">{{ text }}</p>
      <SpeakButton :text="text" :lang="lang" />
    </div>
    <UButton
      :icon="recording ? 'i-lucide-square' : 'i-lucide-mic'"
      :label="recording ? $t('practice.stopRecording') : $t('practice.start')"
      :color="recording ? 'error' : 'primary'"
      block
      @click="practice.record()"
    />
    <PracticePanel :practice="practice" always />
  </div>
</template>
