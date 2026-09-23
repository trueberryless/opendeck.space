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
    class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors"
    :class="over ? ':border-(--accent) bg-muted' : 'border-default'"
    role="button"
    tabindex="0"
    @click="pick"
    @keydown.enter="pick"
    @dragover.prevent="over = true"
    @dragleave.prevent="over = false"
    @drop.prevent="onDrop"
  >
    <UIcon name="i-lucide-upload-cloud" class="size-8 text-neutral-400" />
    <p class="text-sm text-neutral-500 dark:text-neutral-400">
      {{ $t('fileDrop.drop', multiple ? 2 : 1) }} <span class="text-accent">{{ $t('common.browse') }}</span>
    </p>
    <input ref="input" type="file" :accept="accept" :multiple="multiple" class="sr-only" @change="onInput" />
  </div>
</template>
