<script setup lang="ts">
import type { Visibility } from '~/composables/useDecks'
import { parseAnki } from '~/utils/import/anki'
import { parseCsv } from '~/utils/import/csv'
import { parseOpenDeckJson } from '~/utils/import/json'
import { parseQuizlet } from '~/utils/import/quizlet'
import { useI18n } from 'vue-i18n'
import type { ParsedDeck } from '~/utils/import/types'
import { totalMedia } from '~/utils/import/types'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
useHead(() => ({ title: `${t('import.title')} · OpenDeck` }))

const authUser = useAuthUser()
const { supported, ensure } = useSpacesSupport()
const { progress, runImport, cancel, reset } = useImport()
const toast = useToast()

const { prefs } = useProfile()

onMounted(async () => {
  if (await ensure()) visibility.value = prefs.value?.defaultVisibility ?? 'private'
})

type SourceId = 'anki' | 'quizlet' | 'csv' | 'json'

const SOURCES: { id: SourceId; icon: string; steps: number; accept?: string }[] = [
  { id: 'anki', icon: 'i-lucide-brain', accept: '.apkg,.colpkg', steps: 4 },
  { id: 'quizlet', icon: 'i-lucide-square-stack', steps: 4 },
  { id: 'csv', icon: 'i-lucide-table', accept: '.csv,.tsv,.txt', steps: 3 },
  { id: 'json', icon: 'i-lucide-file-json', accept: '.json', steps: 1 },
]

const sourceSteps = computed(() => {
  const def = sourceDef.value
  if (!def) return [] as string[]
  return Array.from({ length: def.steps }, (_, i) => t(`import.sources.${def.id}.step${i + 1}`))
})

const step = ref(1)
const source = ref<SourceId | null>(null)
const sourceDef = computed(() => SOURCES.find((s) => s.id === source.value) ?? null)

const files = ref<File[]>([])
const pasteText = ref('')
const quizletTermDelim = ref('\t')
const quizletCardDelim = ref('\n')
const quizletTitle = ref('')
const csvTitle = ref('')

const parsedDecks = ref<ParsedDeck[]>([])
const warnings = ref<string[]>([])
const selected = ref<Set<number>>(new Set())
const visibility = ref<Visibility>('public')
const parsing = ref(false)

function chooseSource(id: SourceId) {
  source.value = id
  files.value = []
  pasteText.value = ''
  step.value = 2
}

function onFiles(list: File[]) {
  files.value = list
}

async function doParse() {
  if (!source.value) return
  parsing.value = true
  warnings.value = []
  parsedDecks.value = []
  try {
    const decks: ParsedDeck[] = []
    if (source.value === 'anki') {
      for (const file of files.value) {
        const res = await parseAnki(file)
        decks.push(...res.decks)
        warnings.value.push(...res.warnings)
      }
    } else if (source.value === 'quizlet') {
      const res = parseQuizlet(pasteText.value, {
        title: quizletTitle.value || 'Quizlet import',
        termDelim: quizletTermDelim.value,
        cardDelim: quizletCardDelim.value,
      })
      decks.push(...res.decks)
      warnings.value.push(...res.warnings)
    } else if (source.value === 'csv') {
      const texts = files.value.length ? await Promise.all(files.value.map((f) => f.text())) : [pasteText.value]
      texts.forEach((text, i) => {
        const res = parseCsv(text, { title: csvTitle.value || files.value[i]?.name || 'CSV import' })
        decks.push(...res.decks)
        warnings.value.push(...res.warnings)
      })
    } else if (source.value === 'json') {
      for (const file of files.value) {
        const res = parseOpenDeckJson(await file.text())
        decks.push(...res.decks)
        warnings.value.push(...res.warnings)
      }
    }
    parsedDecks.value = decks.filter((d) => d.cards.length > 0)
    selected.value = new Set(parsedDecks.value.map((_, i) => i))
    if (parsedDecks.value.length === 0) {
      toast.add({ title: t('import.nothingToImport'), description: t('import.noCardsFound'), color: 'warning' })
    } else {
      step.value = 3
    }
  } catch (err) {
    toast.add({ title: t('import.couldNotParse'), description: String((err as Error)?.message ?? err), color: 'error' })
  } finally {
    parsing.value = false
  }
}

const canParse = computed(() => {
  if (source.value === 'quizlet') return pasteText.value.trim().length > 0
  if (source.value === 'csv') return files.value.length > 0 || pasteText.value.trim().length > 0
  return files.value.length > 0
})

function toggleDeck(i: number) {
  const next = new Set(selected.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  selected.value = next
}

const selectedDecks = computed(() => parsedDecks.value.filter((_, i) => selected.value.has(i)))
const selectedCardCount = computed(() => selectedDecks.value.reduce((n, d) => n + d.cards.length, 0))
const selectedMediaCount = computed(() => totalMedia(selectedDecks.value))

async function start() {
  if (selectedDecks.value.length === 0) return
  step.value = 4
  await runImport(selectedDecks.value, visibility.value)
  if (progress.value.status === 'done') {
    toast.add({ title: t('import.completeToast'), color: 'success' })
  }
}

function startOver() {
  reset()
  step.value = 1
  source.value = null
  files.value = []
  pasteText.value = ''
  parsedDecks.value = []
}

const selfActor = computed(() => authUser.value?.handle || authUser.value?.did || '')
const pct = computed(() =>
  progress.value.totalCards ? Math.round((progress.value.doneCards / progress.value.totalCards) * 100) : 0,
)
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <div class="flex items-center gap-2">
      <UButton
        to="/"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="$t('common.back')"
      />
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('import.title') }}</h1>
    </div>

    <section v-if="step === 1" class="space-y-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('import.intro') }}</p>
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-sparkles"
        :title="$t('import.noFileTitle')"
        class="[&_a]:text-accent"
      >
        <template #description>
          <i18n-t keypath="import.noFileBody" tag="span">
            <template #link>
              <NuxtLink to="/starter" class="underline">{{ $t('import.starterLink') }}</NuxtLink>
            </template>
          </i18n-t>
        </template>
      </UAlert>
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="s in SOURCES"
          :key="s.id"
          type="button"
          class="border-default hover::border-(--accent) flex items-start gap-3 rounded-lg border p-4 text-start transition-colors"
          @click="chooseSource(s.id)"
        >
          <UIcon :name="s.icon" class="text-accent mt-0.5 size-6" />
          <div>
            <p class="font-medium">{{ $t(`import.sources.${s.id}.label`) }}</p>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t(`import.sources.${s.id}.blurb`) }}</p>
          </div>
        </button>
      </div>
    </section>

    <section v-else-if="step === 2 && sourceDef" class="space-y-5">
      <UButton
        :label="$t('common.back')"
        icon="i-lucide-arrow-left"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="step = 1"
      />
      <div class="border-default rounded-lg border p-4">
        <h2 class="mb-2 font-medium">
          {{ $t('import.howTo', { source: $t(`import.sources.${sourceDef.id}.label`) }) }}
        </h2>
        <ol class="list-inside list-decimal space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
          <li v-for="(s, i) in sourceSteps" :key="i">{{ s }}</li>
        </ol>
      </div>

      <template v-if="source === 'quizlet'">
        <UFormField :label="$t('import.deckTitle')">
          <UInput v-model="quizletTitle" placeholder="My Quizlet set" class="w-full" />
        </UFormField>
        <UFormField :label="$t('import.pastedText')">
          <UTextarea
            v-model="pasteText"
            :rows="8"
            placeholder="term⇥definition, one per line"
            class="w-full font-mono text-sm"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('import.betweenTermDef')">
            <USelect
              v-model="quizletTermDelim"
              :items="[
                { label: $t('import.tab'), value: '\t' },
                { label: $t('import.comma'), value: ',' },
                { label: $t('import.semicolon'), value: ';' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="$t('import.betweenCards')">
            <USelect
              v-model="quizletCardDelim"
              :items="[
                { label: $t('import.newLine'), value: '\n' },
                { label: $t('import.semicolon'), value: ';' },
                { label: $t('import.blankLine'), value: '\n\n' },
              ]"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>

      <template v-else-if="source === 'csv'">
        <UFormField :label="$t('import.deckTitle')">
          <UInput v-model="csvTitle" placeholder="My cards" class="w-full" />
        </UFormField>
        <FileDrop :accept="sourceDef.accept" @files="onFiles" />
        <p class="text-center text-xs text-neutral-400">{{ $t('import.orPaste') }}</p>
        <UTextarea v-model="pasteText" :rows="6" placeholder="front,back" class="w-full font-mono text-sm" />
      </template>

      <template v-else>
        <FileDrop :accept="sourceDef.accept" :multiple="source === 'anki' || source === 'json'" @files="onFiles" />
      </template>

      <div v-if="files.length" class="text-sm text-neutral-500">
        {{ $t('import.filesSelected', { count: files.length }, files.length) }}
      </div>

      <UButton
        :label="$t('import.preview')"
        icon="i-lucide-eye"
        size="lg"
        :loading="parsing"
        :disabled="!canParse"
        @click="doParse"
      />
    </section>

    <section v-else-if="step === 3" class="space-y-5">
      <UButton
        :label="$t('common.back')"
        icon="i-lucide-arrow-left"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="step = 2"
      />

      <UAlert
        v-if="warnings.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="$t('import.warnings', { count: warnings.length })"
        :description="warnings.slice(0, 3).join(' ')"
      />

      <div>
        <h2 class="mb-2 font-medium">{{ $t('import.chooseWhat') }}</h2>
        <ul class="divide-default border-default divide-y overflow-hidden rounded-lg border">
          <li v-for="(deck, i) in parsedDecks" :key="i" class="flex items-center gap-3 p-3">
            <UCheckbox :model-value="selected.has(i)" @update:model-value="toggleDeck(i)" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ deck.title }}</p>
              <p class="text-xs text-neutral-500">
                {{ $t('deck.cardsCount', { count: deck.cards.length }, deck.cards.length) }}
              </p>
            </div>
          </li>
        </ul>
      </div>

      <UFormField v-if="supported" :label="$t('deckEditor.visibility')">
        <div class="flex gap-2">
          <UButton
            :color="visibility === 'public' ? 'primary' : 'neutral'"
            :variant="visibility === 'public' ? 'solid' : 'subtle'"
            icon="i-lucide-globe"
            :label="$t('visibility.public')"
            @click="visibility = 'public'"
          />
          <UButton
            :color="visibility === 'private' ? 'primary' : 'neutral'"
            :variant="visibility === 'private' ? 'solid' : 'subtle'"
            icon="i-lucide-lock"
            :label="$t('visibility.private')"
            @click="visibility = 'private'"
          />
        </div>
      </UFormField>

      <div class="bg-muted rounded-lg p-3 text-sm text-neutral-600 dark:text-neutral-300">
        {{
          selectedMediaCount
            ? $t('import.summaryMedia', {
                decks: selectedDecks.length,
                cards: selectedCardCount,
                media: selectedMediaCount,
              })
            : $t('import.summary', { decks: selectedDecks.length, cards: selectedCardCount })
        }}
      </div>

      <UButton
        :label="$t('import.startImport')"
        icon="i-lucide-upload"
        size="lg"
        :disabled="selectedDecks.length === 0"
        @click="start"
      />
    </section>

    <section v-else-if="step === 4" class="space-y-5">
      <div class="border-default rounded-lg border p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-medium">
            <template v-if="progress.status === 'running'">{{ $t('import.importing') }}</template>
            <template v-else-if="progress.status === 'paused'">{{ $t('import.paused') }}</template>
            <template v-else-if="progress.status === 'done'">{{ $t('import.complete') }}</template>
            <template v-else-if="progress.status === 'cancelled'">{{ $t('import.cancelled') }}</template>
            <template v-else-if="progress.status === 'error'">{{ $t('import.error') }}</template>
          </h2>
          <span class="text-sm text-neutral-400">{{ progress.doneCards }}/{{ progress.totalCards }}</span>
        </div>

        <UProgress :model-value="pct" :max="100" />

        <p v-if="progress.currentDeck && progress.status === 'running'" class="mt-3 truncate text-sm text-neutral-500">
          {{ progress.currentDeck }}
        </p>
        <p v-if="progress.status === 'paused'" class="text-warning mt-3 text-sm">
          {{ $t('import.waiting', { seconds: progress.pauseSeconds }) }}
        </p>
        <p v-if="progress.totalMedia" class="mt-1 text-xs text-neutral-400">
          {{ $t('import.media', { done: progress.doneMedia, total: progress.totalMedia }) }}
        </p>

        <div class="mt-4 flex gap-2">
          <UButton
            v-if="progress.status === 'running' || progress.status === 'paused'"
            :label="$t('common.cancel')"
            color="neutral"
            variant="subtle"
            @click="cancel"
          />
          <UButton
            v-else
            :label="$t('import.importMore')"
            icon="i-lucide-plus"
            color="neutral"
            variant="subtle"
            @click="startOver"
          />
        </div>
      </div>

      <div v-if="progress.created.length" class="space-y-1">
        <h3 class="text-sm font-medium">{{ $t('import.createdDecks') }}</h3>
        <ul class="text-sm">
          <li v-for="d in progress.created" :key="d.rkey">
            <NuxtLink :to="deckPath(selfActor, d.rkey)" class="text-accent hover:underline">{{ d.title }}</NuxtLink>
          </li>
        </ul>
      </div>

      <UAlert
        v-if="progress.errors.length"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :description="progress.errors.join(' ')"
      />
    </section>
  </div>
</template>
