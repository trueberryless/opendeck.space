<script setup lang="ts">
defineProps<{ accept?: string; multiple?: boolean }>()
const emit = defineEmits<{ files: [File[]] }>()

const over = ref(false)
const input = ref<HTMLInputElement | null>(null)

function pick() {
  input.value?.click()
}
function onInput(event: Event) {
  emit('files', Array.from((event.target as HTMLInputElement).files ?? []))
}
function onDrop(event: DragEvent) {
  over.value = false
  emit('files', Array.from(event.dataTransfer?.files ?? []))
}
</script>

<template>
  <div
    class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors focus-visible:border-(--accent)"
    :class="over ? 'bg-muted border-(--accent)' : 'border-accented'"
    role="button"
    tabindex="0"
    :aria-label="`${$t(multiple ? 'fileDrop.dropFiles' : 'fileDrop.dropFile')} ${$t('common.browse')}`"
    @click="pick"
    @keydown.enter.prevent="pick"
    @keydown.space.prevent="pick"
    @dragover.prevent="over = true"
    @dragleave.prevent="over = false"
    @drop.prevent="onDrop"
  >
    <UIcon name="i-lucide-upload-cloud" class="text-muted size-8" aria-hidden="true" />
    <p class="text-muted text-sm">
      {{ $t(multiple ? 'fileDrop.dropFiles' : 'fileDrop.dropFile') }}
      <span class="text-accent">{{ $t('common.browse') }}</span>
    </p>
    <input
      ref="input"
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="onInput"
    />
  </div>
</template>
