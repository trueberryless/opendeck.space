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
    <UFormField :label="$t('deckEditor.title')" name="title" required>
      <UInput v-model="form.title" :placeholder="$t('deckEditor.titlePlaceholder')" size="lg" class="w-full" />
    </UFormField>

    <UFormField :label="$t('deckEditor.description')" name="summary">
      <UTextarea
        v-model="form.summary"
        :placeholder="$t('deckEditor.descriptionPlaceholder')"
        :rows="3"
        class="w-full"
      />
    </UFormField>

    <div class="grid grid-cols-2 gap-4">
      <UFormField :label="$t('deckEditor.fromLang')" name="sourceLang" :hint="$t('deckEditor.fromHint')">
        <UInput v-model="form.sourceLang" placeholder="en" class="w-full" />
      </UFormField>
      <UFormField :label="$t('deckEditor.toLang')" name="targetLang" :hint="$t('deckEditor.toHint')">
        <UInput v-model="form.targetLang" placeholder="es" class="w-full" />
      </UFormField>
    </div>

    <UFormField :label="$t('deckEditor.tags')" name="tags" :hint="$t('deckEditor.tagsHint')">
      <UInput v-model="form.tagsInput" :placeholder="$t('deckEditor.tagsPlaceholder')" class="w-full" />
    </UFormField>

    <UFormField v-if="showVisibility" :label="$t('deckEditor.visibility')" name="visibility">
      <div class="flex gap-2">
        <UButton
          :color="form.visibility === 'public' ? 'primary' : 'neutral'"
          :variant="form.visibility === 'public' ? 'solid' : 'subtle'"
          icon="i-lucide-globe"
          :label="$t('visibility.public')"
          @click="form.visibility = 'public'"
        />
        <UButton
          :color="form.visibility === 'private' ? 'primary' : 'neutral'"
          :variant="form.visibility === 'private' ? 'solid' : 'subtle'"
          icon="i-lucide-lock"
          :label="$t('visibility.private')"
          @click="form.visibility = 'private'"
        />
      </div>
    </UFormField>

    <div class="flex justify-end gap-2">
      <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="emit('cancel')" />
      <UButton
        type="submit"
        :label="submitLabel ?? $t('common.save')"
        :loading="saving"
        :disabled="!form.title.trim()"
      />
    </div>
  </form>
</template>
