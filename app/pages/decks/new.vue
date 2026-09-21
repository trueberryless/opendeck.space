<script setup lang="ts">
import type { DeckFormData } from '~/components/DeckEditor.vue'
import type { Visibility } from '~/composables/useDecks'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'New deck · OpenDeck' })

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
    toast.add({ title: 'Could not create deck', description: String(err), color: 'error' })
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6">
    <div class="flex items-center gap-2">
      <UButton to="/" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" />
      <h1 class="text-2xl font-bold tracking-tight">New deck</h1>
    </div>

    <DeckEditor
      :visibility="defaultVisibility"
      :show-visibility="supported === true"
      :saving="saving"
      submit-label="Create deck"
      @save="submit"
      @cancel="navigateTo('/')"
    />
  </div>
</template>
