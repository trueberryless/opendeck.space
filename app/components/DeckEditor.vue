<script setup lang="ts">
import type { DeckValue, Visibility } from '~/composables/useDecks'

export interface DeckFormData {
  title: string
  summary?: string
  sourceLang?: string
  targetLang?: string
  tags?: string[]
  visibility: Visibility
}

const props = defineProps<{
  deck?: Partial<DeckValue>
  visibility?: Visibility
  showVisibility?: boolean
  saving?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{ save: [data: DeckFormData]; cancel: [] }>()

const form = reactive({
  title: props.deck?.title ?? '',
  summary: props.deck?.summary ?? '',
  sourceLang: props.deck?.sourceLang ?? '',
  targetLang: props.deck?.targetLang ?? '',
  tagsInput: (props.deck?.tags ?? []).join(', '),
  visibility: (props.visibility ?? 'public') as Visibility,
})

function submit() {
  if (!form.title.trim()) return
  const tags = form.tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  emit('save', {
    title: form.title.trim(),
    summary: form.summary.trim() || undefined,
    sourceLang: form.sourceLang.trim() || undefined,
    targetLang: form.targetLang.trim() || undefined,
    tags: tags.length ? tags : undefined,
    visibility: form.visibility,
  })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <UFormField label="Title" name="title" required>
      <UInput v-model="form.title" placeholder="Spanish essentials" size="lg" class="w-full" />
    </UFormField>

    <UFormField label="Description" name="summary">
      <UTextarea v-model="form.summary" placeholder="What this deck covers" :rows="3" class="w-full" />
    </UFormField>

    <div class="grid grid-cols-2 gap-4">
      <UFormField label="From language" name="sourceLang" hint="You know">
        <UInput v-model="form.sourceLang" placeholder="en" class="w-full" />
      </UFormField>
      <UFormField label="To language" name="targetLang" hint="Learning">
        <UInput v-model="form.targetLang" placeholder="es" class="w-full" />
      </UFormField>
    </div>

    <UFormField label="Tags" name="tags" hint="Comma-separated">
      <UInput v-model="form.tagsInput" placeholder="travel, food, a1" class="w-full" />
    </UFormField>

    <UFormField v-if="showVisibility" label="Visibility" name="visibility">
      <div class="flex gap-2">
        <UButton
          :color="form.visibility === 'public' ? 'primary' : 'neutral'"
          :variant="form.visibility === 'public' ? 'solid' : 'subtle'"
          icon="i-lucide-globe"
          label="Public"
          @click="form.visibility = 'public'"
        />
        <UButton
          :color="form.visibility === 'private' ? 'primary' : 'neutral'"
          :variant="form.visibility === 'private' ? 'solid' : 'subtle'"
          icon="i-lucide-lock"
          label="Private"
          @click="form.visibility = 'private'"
        />
      </div>
    </UFormField>

    <div class="flex justify-end gap-2">
      <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('cancel')" />
      <UButton type="submit" :label="submitLabel ?? 'Save'" :loading="saving" :disabled="!form.title.trim()" />
    </div>
  </form>
</template>
