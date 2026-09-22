<script setup lang="ts">
import type { DeckFormData } from '~/components/DeckEditor.vue'
import type { Visibility } from '~/composables/useDecks'

import { useI18n } from 'vue-i18n'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
useHead(() => ({ title: `${t('newDeck.title')} · OpenDeck` }))

const { createDeck } = useDecks()
const { supported, ensure } = useSpacesSupport()
const { prefs } = useProfile()
const authUser = useAuthUser()
const toast = useToast()

const saving = ref(false)

onMounted(ensure)

const defaultVisibility = computed<Visibility>(
  () => prefs.value?.defaultVisibility ?? (supported.value ? 'private' : 'public'),
)

async function submit(data: DeckFormData) {
  saving.value = true
  try {
    const deck = await createDeck(
      {
        title: data.title,
        summary: data.summary,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        tags: data.tags,
      },
      data.visibility,
    )
    await navigateTo(deckPath(authUser.value?.handle || authUser.value?.did || '', deck.rkey))
  } catch (err) {
    toast.add({ title: t('newDeck.createError'), description: String(err), color: 'error' })
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6">
    <div class="flex items-center gap-2">
      <UButton
        to="/"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="$t('common.back')"
      />
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('newDeck.title') }}</h1>
    </div>

    <DeckEditor
      :visibility="defaultVisibility"
      :show-visibility="supported === true"
      :saving="saving"
      :submit-label="$t('deckEditor.createDeck')"
      @save="submit"
      @cancel="navigateTo('/')"
    />
  </div>
</template>
