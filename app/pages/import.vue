<script setup lang="ts">
import type { Visibility } from '~/composables/useDecks'
import { parseAnki } from '~/utils/import/anki'
import { parseCsv } from '~/utils/import/csv'
import { parseOpenDeckJson } from '~/utils/import/json'
import { parseQuizlet } from '~/utils/import/quizlet'
import type { ParsedDeck } from '~/utils/import/types'
import { totalMedia } from '~/utils/import/types'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Import · OpenDeck' })

const authUser = useAuthUser()
const { supported, ensure } = useSpacesSupport()
const { progress, runImport, cancel, reset } = useImport()
const toast = useToast()

const { prefs } = useProfile()

onMounted(async () => {
  if (await ensure()) visibility.value = prefs.value?.defaultVisibility ?? 'private'
})

type SourceId = 'anki' | 'quizlet' | 'csv' | 'json'

const SOURCES: { id: SourceId; label: string; icon: string; blurb: string; steps: string[]; accept?: string }[] = [
  {
    id: 'anki',
    label: 'Anki',
    icon: 'i-lucide-brain',
    blurb: '.apkg or .colpkg, with decks and media',
    accept: '.apkg,.colpkg',
    steps: [
      'In the Anki desktop app, choose File → Export.',
      'Pick “Anki Deck Package (.apkg)” for one deck, or “Anki Collection Package (.colpkg)” for your whole profile.',
      'Keep “Include media” checked so images and audio come across.',
      'Upload the exported file or files below. You can add several at once.',
    ],
  },
  {
    id: 'quizlet',
    label: 'Quizlet',
    icon: 'i-lucide-square-stack',
    blurb: 'Paste an exported set',
    steps: [
      'Open your set on Quizlet and click ⋯ (More) → Export.',
      'Leave “Between term and definition” as Tab and “Between cards” as New line.',
      'Click Copy text.',
      'Paste it below.',
    ],
  },
  {
    id: 'csv',
    label: 'CSV / TSV',
    icon: 'i-lucide-table',
    blurb: 'A spreadsheet of front,back',
    accept: '.csv,.tsv,.txt',
    steps: [
      'Export or save your cards as CSV or TSV.',
      'Put the front in the first column and the back in the second (an optional hint in the third).',
      'Upload the file below.',
    ],
  },
  {
    id: 'json',
    label: 'OpenDeck JSON',
    icon: 'i-lucide-file-json',
    blurb: 'A file exported from OpenDeck',
    accept: '.json',
    steps: ['Upload a .json file you exported from OpenDeck.'],
  },
]

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
      toast.add({ title: 'Nothing to import', description: 'No cards were found.', color: 'warning' })
    } else {
      step.value = 3
    }
  } catch (err) {
    toast.add({ title: 'Could not parse', description: String((err as Error)?.message ?? err), color: 'error' })
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
    toast.add({ title: 'Import complete', color: 'success' })
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
      <UButton to="/" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" />
      <h1 class="text-2xl font-bold tracking-tight">Import</h1>
    </div>

    <!-- Step 1: choose source -->
    <section v-if="step === 1" class="space-y-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Bring your cards from another app. Everything runs in your browser and is saved to your ATproto repository.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="s in SOURCES"
          :key="s.id"
          type="button"
          class="border-default hover::border-(--accent) flex items-start gap-3 rounded-lg border p-4 text-left transition-colors"
          @click="chooseSource(s.id)"
        >
          <UIcon :name="s.icon" class="text-accent mt-0.5 size-6" />
          <div>
            <p class="font-medium">{{ s.label }}</p>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ s.blurb }}</p>
          </div>
        </button>
      </div>
    </section>

    <!-- Step 2: instructions + input -->
    <section v-else-if="step === 2 && sourceDef" class="space-y-5">
      <UButton label="Back" icon="i-lucide-arrow-left" size="xs" color="neutral" variant="ghost" @click="step = 1" />
      <div class="border-default rounded-lg border p-4">
        <h2 class="mb-2 font-medium">How to export from {{ sourceDef.label }}</h2>
        <ol class="list-inside list-decimal space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
          <li v-for="(s, i) in sourceDef.steps" :key="i">{{ s }}</li>
        </ol>
      </div>

      <!-- Quizlet paste -->
      <template v-if="source === 'quizlet'">
        <UFormField label="Deck title">
          <UInput v-model="quizletTitle" placeholder="My Quizlet set" class="w-full" />
        </UFormField>
        <UFormField label="Pasted text">
          <UTextarea
            v-model="pasteText"
            :rows="8"
            placeholder="term⇥definition, one per line"
            class="w-full font-mono text-sm"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Between term & definition">
            <USelect
              v-model="quizletTermDelim"
              :items="[
                { label: 'Tab', value: '\t' },
                { label: 'Comma', value: ',' },
                { label: 'Semicolon', value: ';' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Between cards">
            <USelect
              v-model="quizletCardDelim"
              :items="[
                { label: 'New line', value: '\n' },
                { label: 'Semicolon', value: ';' },
                { label: 'Blank line', value: '\n\n' },
              ]"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>

      <!-- CSV: file or paste -->
      <template v-else-if="source === 'csv'">
        <UFormField label="Deck title">
          <UInput v-model="csvTitle" placeholder="My cards" class="w-full" />
        </UFormField>
        <FileDrop :accept="sourceDef.accept" @files="onFiles" />
        <p class="text-center text-xs text-neutral-400">or paste below</p>
        <UTextarea v-model="pasteText" :rows="6" placeholder="front,back" class="w-full font-mono text-sm" />
      </template>

      <!-- Anki / JSON: files -->
      <template v-else>
        <FileDrop :accept="sourceDef.accept" :multiple="source === 'anki' || source === 'json'" @files="onFiles" />
      </template>

      <div v-if="files.length" class="text-sm text-neutral-500">
        {{ files.length }} file{{ files.length === 1 ? '' : 's' }} selected
      </div>

      <UButton
        label="Preview"
        icon="i-lucide-eye"
        size="lg"
        :loading="parsing"
        :disabled="!canParse"
        @click="doParse"
      />
    </section>

    <!-- Step 3: preview + options -->
    <section v-else-if="step === 3" class="space-y-5">
      <UButton label="Back" icon="i-lucide-arrow-left" size="xs" color="neutral" variant="ghost" @click="step = 2" />

      <UAlert
        v-if="warnings.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${warnings.length} warning(s)`"
        :description="warnings.slice(0, 3).join(' ')"
      />

      <div>
        <h2 class="mb-2 font-medium">Choose what to import</h2>
        <ul class="divide-default border-default divide-y overflow-hidden rounded-lg border">
          <li v-for="(deck, i) in parsedDecks" :key="i" class="flex items-center gap-3 p-3">
            <UCheckbox :model-value="selected.has(i)" @update:model-value="toggleDeck(i)" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ deck.title }}</p>
              <p class="text-xs text-neutral-500">{{ deck.cards.length }} cards</p>
            </div>
          </li>
        </ul>
      </div>

      <UFormField v-if="supported" label="Visibility">
        <div class="flex gap-2">
          <UButton
            :color="visibility === 'public' ? 'primary' : 'neutral'"
            :variant="visibility === 'public' ? 'solid' : 'subtle'"
            icon="i-lucide-globe"
            label="Public"
            @click="visibility = 'public'"
          />
          <UButton
            :color="visibility === 'private' ? 'primary' : 'neutral'"
            :variant="visibility === 'private' ? 'solid' : 'subtle'"
            icon="i-lucide-lock"
            label="Private"
            @click="visibility = 'private'"
          />
        </div>
      </UFormField>

      <div class="bg-muted rounded-lg p-3 text-sm text-neutral-600 dark:text-neutral-300">
        Importing <strong>{{ selectedDecks.length }}</strong> deck(s),
        <strong>{{ selectedCardCount }}</strong> cards<span v-if="selectedMediaCount"
          >, <strong>{{ selectedMediaCount }}</strong> media files</span
        >. Large imports are paced to respect your PDS's rate limits and may pause automatically.
      </div>

      <UButton
        label="Start import"
        icon="i-lucide-upload"
        size="lg"
        :disabled="selectedDecks.length === 0"
        @click="start"
      />
    </section>

    <!-- Step 4: progress -->
    <section v-else-if="step === 4" class="space-y-5">
      <div class="border-default rounded-lg border p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-medium">
            <template v-if="progress.status === 'running'">Importing…</template>
            <template v-else-if="progress.status === 'paused'">Paused for rate limit</template>
            <template v-else-if="progress.status === 'done'">Import complete 🎉</template>
            <template v-else-if="progress.status === 'cancelled'">Import cancelled</template>
            <template v-else-if="progress.status === 'error'">Import error</template>
          </h2>
          <span class="text-sm text-neutral-400">{{ progress.doneCards }}/{{ progress.totalCards }}</span>
        </div>

        <UProgress :model-value="pct" :max="100" />

        <p v-if="progress.currentDeck && progress.status === 'running'" class="mt-3 truncate text-sm text-neutral-500">
          {{ progress.currentDeck }}
        </p>
        <p v-if="progress.status === 'paused'" class="text-warning mt-3 text-sm">
          Waiting {{ progress.pauseSeconds }}s to stay within your PDS rate limit…
        </p>
        <p v-if="progress.totalMedia" class="mt-1 text-xs text-neutral-400">
          Media {{ progress.doneMedia }}/{{ progress.totalMedia }}
        </p>

        <div class="mt-4 flex gap-2">
          <UButton
            v-if="progress.status === 'running' || progress.status === 'paused'"
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="cancel"
          />
          <UButton
            v-else
            label="Import more"
            icon="i-lucide-plus"
            color="neutral"
            variant="subtle"
            @click="startOver"
          />
        </div>
      </div>

      <div v-if="progress.created.length" class="space-y-1">
        <h3 class="text-sm font-medium">Created decks</h3>
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
