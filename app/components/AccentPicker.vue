<script setup lang="ts">
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="preset in ACCENT_PRESETS"
        :key="preset.value"
        type="button"
        class="ring-offset-bg size-8 rounded-full ring-offset-2 transition focus:outline-none focus-visible:ring-2"
        :class="model === preset.value ? 'ring-2 ring-(--accent)' : ''"
        :style="{ backgroundColor: preset.value }"
        :aria-label="preset.name"
        :aria-pressed="model === preset.value"
        @click="model = preset.value"
      />
      <label
        class="border-default grid size-8 cursor-pointer place-items-center rounded-full border"
        aria-label="Custom color"
      >
        <UIcon name="i-lucide-pipette" class="size-4 text-neutral-400" />
        <input v-model="model" type="color" class="sr-only" />
      </label>
    </div>
    <p class="text-xs text-neutral-400">Synced across your devices via your ATproto profile.</p>
  </div>
</template>
