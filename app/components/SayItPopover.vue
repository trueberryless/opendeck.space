<script setup lang="ts">
import { recorderSupported } from '~/composables/useRecorder'

const { lang, readings, text } = defineProps<{ lang?: string; readings?: (string | undefined)[]; text: string }>()

const supported = ref(false)
onMounted(() => (supported.value = recorderSupported()))
</script>

<template>
  <UPopover v-if="supported && text.trim()" :content="{ align: 'start', side: 'bottom', sideOffset: 6 }">
    <UButton
      icon="i-lucide-mic"
      color="neutral"
      variant="ghost"
      size="xs"
      class="shrink-0"
      :aria-label="$t('practice.sayIt', { text })"
    />
    <template #content>
      <SayItStation :text="text" :lang="lang" :readings="readings" />
    </template>
  </UPopover>
</template>
