<script setup lang="ts">
import type { CardView, DeckView } from '~/composables/useDecks'
import type { ProgressRecord } from '~/composables/useStudy'
import { useI18n } from 'vue-i18n'
import { ASSISTANTS, assistantPrompt, assistantUrl, pickVocabulary } from '~/utils/conversation'
import { directionKey } from '~/utils/fsrs'
import { languageName } from '~/utils/speech'

const { cards, deck, progress } = defineProps<{
  cards: CardView[]
  deck: DeckView
  progress: Map<string, ProgressRecord>
}>()

const { locale, t } = useI18n()
const toast = useToast()
const { copy, isSupported: canCopy } = useClipboard({ legacy: true })

const target = computed(() => languageName(deck.value.targetLang ?? '', locale.value))
const source = computed(() => languageName(deck.value.sourceLang ?? locale.value, locale.value))
const words = computed(() =>
  pickVocabulary(
    cards.map((card) => ({
      text: card.value.back,
      reading: card.value.backReading,
      progress: (['forward', 'reverse'] as const).flatMap((d) => {
        const record = progress.get(directionKey(card.uri, d))
        return record ? [record.value] : []
      }),
    })),
    new Date(),
  ),
)

function render(list: readonly string[]): string {
  const base = { target: target.value, source: source.value }
  return list.length
    ? t('conversation.prompt', { ...base, words: list.join(', ') })
    : t('conversation.promptNoWords', base)
}

const prompt = computed(() => render(words.value))
const links = computed(() =>
  ASSISTANTS.flatMap((assistant) => {
    const fitted = assistantPrompt(assistant, words.value, render)
    return fitted ? [{ ...assistant, url: assistantUrl(assistant, fitted.prompt) }] : []
  }),
)

async function copyPrompt() {
  try {
    await copy(prompt.value)
    toast.add({ title: t('conversation.copied'), color: 'success' })
  } catch {
    toast.add({ title: t('conversation.copyFailed'), color: 'error' })
  }
}
</script>

<template>
  <UModal :title="$t('conversation.title')" :description="$t('conversation.description', { language: target })">
    <UButton
      :label="$t('conversation.open')"
      icon="i-lucide-messages-square"
      color="neutral"
      variant="subtle"
      :disabled="!deck.value.targetLang"
    />
    <template #body>
      <div class="space-y-4">
        <p class="text-muted text-sm">{{ $t('conversation.voiceHelp') }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="link in links"
            :key="link.id"
            :to="link.url"
            target="_blank"
            rel="noopener noreferrer"
            trailing-icon="i-lucide-external-link"
            :label="$t('conversation.openIn', { assistant: link.name })"
            :aria-label="$t('conversation.openInNewTab', { assistant: link.name })"
          />
          <UButton
            v-if="canCopy"
            icon="i-lucide-copy"
            :label="$t('conversation.copy')"
            color="neutral"
            variant="subtle"
            @click="copyPrompt"
          />
        </div>
        <p class="text-muted text-xs">{{ $t('conversation.privacy') }}</p>
        <details class="border-default rounded-lg border p-3 text-sm">
          <summary class="cursor-pointer font-medium">{{ $t('conversation.preview') }}</summary>
          <p class="text-muted mt-2 whitespace-pre-line">{{ prompt }}</p>
        </details>
      </div>
    </template>
  </UModal>
</template>
