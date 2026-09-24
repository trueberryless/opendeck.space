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
        class="ring-offset-bg size-8 rounded-full border border-black/20 ring-offset-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ui-text-highlighted) dark:border-white/30"
        :class="model === preset.value ? 'ring-2 ring-(--accent)' : ''"
        :style="{ backgroundColor: preset.value }"
        :aria-label="$t(`settings.accents.${preset.name}`)"
        :aria-pressed="model === preset.value"
        @click="model = preset.value"
      />
      <label
        class="border-accented ring-offset-bg grid size-8 cursor-pointer place-items-center rounded-full border ring-offset-2 focus-within:ring-2 focus-within:ring-(--ui-text-highlighted)"
      >
        <UIcon name="i-lucide-pipette" class="text-muted size-4" aria-hidden="true" />
        <input v-model="model" type="color" class="sr-only" :aria-label="$t('settings.customColor')" />
      </label>
    </div>
    <p class="text-muted text-xs">{{ $t('settings.accentSynced') }}</p>
  </div>
</template>
