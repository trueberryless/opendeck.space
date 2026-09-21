<script setup lang="ts">
defineProps<{
  front: string
  back: string
  hint?: string
  phonetic?: string
  examples?: string[]
  did?: string
  image?: unknown
  imageAlt?: string
  audio?: unknown
  showHint: boolean
  revealed: boolean
}>()

const emit = defineEmits<{ revealHint: [] }>()
</script>

<template>
  <div
    class="border-default bg-muted flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border p-8 text-center select-none"
  >
    <!-- Image stays visible; audio (pronunciation) is only revealed with the answer. -->
    <CardMedia v-if="did && image" :did="did" :image="image" :image-alt="imageAlt" class="mb-4 w-full" />

    <p class="text-2xl font-semibold text-balance">{{ front }}</p>

    <div v-if="hint && !revealed" class="mt-3">
      <p v-if="showHint" class="text-sm text-neutral-400">{{ hint }}</p>
      <button
        v-else
        type="button"
        class="hover:text-accent text-xs text-neutral-400 underline"
        @click.stop="emit('revealHint')"
      >
        Show hint
      </button>
    </div>

    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="translate-y-1 opacity-0">
      <div v-if="revealed" class="mt-6 w-full space-y-3">
        <hr class="border-default" />
        <p class="text-xl text-balance">{{ back }}</p>
        <p v-if="phonetic" class="text-sm text-neutral-400">{{ phonetic }}</p>
        <CardMedia v-if="did && audio" :did="did" :audio="audio" class="w-full" />
        <ul v-if="examples?.length" class="space-y-1 text-sm text-neutral-500 dark:text-neutral-400">
          <li v-for="(ex, i) in examples" :key="i">“{{ ex }}”</li>
        </ul>
      </div>
    </Transition>

    <p v-if="!revealed" class="mt-6 text-xs text-neutral-400">Tap or press space to reveal</p>
  </div>
</template>
