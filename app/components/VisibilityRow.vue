<script setup lang="ts">
import type { ShowTo } from '~/utils/records'

const model = defineModel<ShowTo>({ required: true })
withDefaults(
  defineProps<{
    title: string
    description?: string
    options?: ShowTo[]
    locked?: ShowTo[]
    lockedHint?: string
    disabled?: boolean
  }>(),
  { options: () => ['nobody', 'me', 'everyone'], locked: () => [] },
)
const id = useId()

const ICONS: Record<ShowTo, string> = {
  nobody: 'i-lucide-eye-off',
  me: 'i-lucide-lock',
  everyone: 'i-lucide-globe',
}
</script>

<template>
  <div class="border-default space-y-3 rounded-lg border p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0 flex-1 basis-60">
        <p :id="id" class="font-medium">{{ title }}</p>
        <p v-if="description" :id="`${id}-description`" class="text-muted text-sm">{{ description }}</p>
      </div>
      <div
        class="flex shrink-0 flex-wrap gap-1"
        role="group"
        :aria-labelledby="id"
        :aria-describedby="description ? `${id}-description` : undefined"
      >
        <UButton
          v-for="option in options"
          :key="option"
          :icon="ICONS[option]"
          :label="$t(`showTo.${option}`)"
          :aria-pressed="model === option"
          :color="model === option ? 'primary' : 'neutral'"
          :variant="model === option ? 'solid' : 'subtle'"
          :disabled="disabled || locked.includes(option)"
          size="sm"
          @click="model = option"
        />
      </div>
    </div>
    <p v-if="lockedHint && locked.length" class="text-muted text-xs">{{ lockedHint }}</p>
    <slot />
  </div>
</template>
