<script setup lang="ts">
import type { CardView, DeckView } from '~/composables/useDecks'
import type { ProgressRecord } from '~/composables/useStudy'
import { packLines, type DialogueRole } from '~/composables/useStarterPacks'
import { useI18n } from 'vue-i18n'
import { LOCALES } from '~/utils/i18n'
import { MAX_TEXT_BYTES, splitSentences } from '~/utils/sentences'
import { languageName, uniqueSpeechLanguages } from '~/utils/speech'

definePageMeta({ middleware: 'auth' })

type Source = 'deck' | 'text' | 'pack'

interface SpeakItem {
  lang?: string
  reading?: string
  role?: DialogueRole
  text: string
  translation?: string
  translationLang?: string
}

const ALL_SECTIONS = 'all'

const SOURCES: { icon: string; value: Source }[] = [
  { value: 'pack', icon: 'i-lucide-message-circle' },
  { value: 'deck', icon: 'i-lucide-layers' },
  { value: 'text', icon: 'i-lucide-file-text' },
]

const { locale, t } = useI18n()
const route = useRoute()
const toast = useToast()
const decks = useDecks()
const study = useStudy()
const speech = useSpeech()
const { speaking } = useStarterPacks()

useHead(() => ({ title: `${t('speak.title')} · OpenDeck` }))

const queryDeck = typeof route.query.deck === 'string' ? route.query.deck : ''
const source = ref<Source>(queryDeck ? 'deck' : 'pack')

const myDecks = ref<DeckView[]>([])
const decksLoaded = ref(false)
const deckRkey = ref(queryDeck)
const deckCards = ref<CardView[]>([])
const progress = ref<Map<string, ProgressRecord>>(new Map())
const deck = computed(() => myDecks.value.find((d) => d.rkey === deckRkey.value))
const deckItems = computed(() => myDecks.value.map((d) => ({ value: d.rkey, label: d.value.title })))

onMounted(async () => {
  try {
    myDecks.value = await decks.listMyDecks()
    if (!deck.value) deckRkey.value = myDecks.value[0]?.rkey ?? ''
    progress.value = await study.loadProgressMap().catch(() => new Map())
  } catch (err) {
    console.error('[opendeck] failed to load decks for speaking', err)
  } finally {
    decksLoaded.value = true
  }
})

watch(deck, async (view) => {
  deckCards.value = []
  if (!view) return
  try {
    deckCards.value = await decks.listMyCards(view.rkey, view.visibility)
  } catch (err) {
    console.error('[opendeck] failed to load cards for speaking', err)
  }
})

const text = ref('')
const textLang = ref('')
const languageItems = computed(() =>
  uniqueSpeechLanguages([
    ...myDecks.value.flatMap((d) => [d.value.targetLang, d.value.sourceLang]),
    ...LOCALES.map((l) => l.code),
  ])
    .map((code) => ({ value: code, label: languageName(code, locale.value) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale.value)),
)
watchEffect(() => {
  if (!textLang.value) textLang.value = myDecks.value[0]?.value.targetLang ?? locale.value
})

async function onFiles(files: File[]) {
  const [file] = files
  if (!file) return
  if (file.size > MAX_TEXT_BYTES) {
    toast.add({ title: t('speak.fileTooLarge'), color: 'error' })
    return
  }
  try {
    text.value = await file.text()
  } catch {
    toast.add({ title: t('speak.fileUnreadable'), color: 'error' })
  }
}

const packs = speaking()
const packId = ref(packs[0]?.id ?? '')
const pack = computed(() => packs.find((p) => p.id === packId.value))
const packItems = computed(() => packs.map((p) => ({ value: p.id, label: t(`packs.${p.id}.name`) })))
const packLang = ref('')
const packLangItems = computed(() =>
  (pack.value?.languages ?? [])
    .map((code) => ({ value: code, label: languageName(code, locale.value) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale.value)),
)
const isDialogue = computed(() => pack.value?.kind === 'dialogue')
const section = ref(ALL_SECTIONS)
const sectionItems = computed(() => [
  ...(isDialogue.value ? [] : [{ value: ALL_SECTIONS, label: t('speak.allSections') }]),
  ...(pack.value?.sections ?? []).map((s) => ({ value: s, label: t(`packs.${pack.value?.id}.sections.${s}`) })),
])
const learnerRole = ref<DialogueRole>('b')
const roleItems = computed(() => [
  { value: 'b', label: t('speak.roleB') },
  { value: 'a', label: t('speak.roleA') },
])
watch(
  pack,
  (selected) => {
    if (!selected) return
    if (!selected.languages.includes(packLang.value)) {
      const preferred = myDecks.value.map((d) => d.value.targetLang).find((l) => l && selected.languages.includes(l))
      packLang.value = preferred ?? selected.languages.find((l) => l !== locale.value) ?? selected.languages[0] ?? ''
    }
    section.value = selected.kind === 'dialogue' ? (selected.sections[0] ?? ALL_SECTIONS) : ALL_SECTIONS
  },
  { immediate: true },
)
const translationLang = computed(() =>
  pack.value?.languages.includes(locale.value) ? locale.value : pack.value?.languages.includes('en') ? 'en' : undefined,
)

const items = computed<SpeakItem[]>(() => {
  if (source.value === 'deck') {
    const view = deck.value
    return deckCards.value
      .filter((c) => c.value.back.trim())
      .map((c) => ({
        text: c.value.back,
        reading: c.value.backReading,
        lang: view?.value.targetLang,
        translation: c.value.front,
        translationLang: view?.value.sourceLang,
      }))
  }
  if (source.value === 'text')
    return splitSentences(text.value, textLang.value).map((sentence) => ({ text: sentence, lang: textLang.value }))
  const current = pack.value
  if (!current) return []
  return packLines(current, packLang.value, translationLang.value)
    .filter((line) => section.value === ALL_SECTIONS || line.section === section.value)
    .map((line) => ({
      text: line.text,
      reading: line.reading,
      role: isDialogue.value ? line.role : undefined,
      lang: packLang.value,
      translation: line.translation,
      translationLang: translationLang.value,
    }))
})

const session = shallowRef<SpeakItem[] | null>(null)
const index = ref(0)
const scores = ref<Record<number, number>>({})
const dialogueSession = ref(false)
const item = computed(() => session.value?.[index.value])
const done = computed(() => Boolean(session.value) && !item.value)
const appTurn = computed(() => dialogueSession.value && Boolean(item.value) && item.value?.role !== learnerRole.value)
const history = computed(() => (dialogueSession.value ? (session.value ?? []).slice(0, index.value) : []))
const average = computed(() => {
  const values = Object.values(scores.value)
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
})
const averageLabel = computed(() =>
  new Intl.NumberFormat(locale.value, { style: 'percent' }).format((average.value ?? 0) / 100),
)

const practice = usePractice(() => ({
  key: index.value,
  text: item.value?.text ?? '',
  lang: item.value?.lang,
  readings: [item.value?.reading],
}))
const recording = computed(() => practice.recorder.state.value !== 'idle')

watch(practice.result, (result) => {
  if (result) scores.value = { ...scores.value, [index.value]: result.score }
})
watch(item, (line) => {
  if (line && appTurn.value) speech.speak(line.text, line.lang)
})

function start() {
  dialogueSession.value = source.value === 'pack' && isDialogue.value
  scores.value = {}
  index.value = 0
  session.value = [...items.value]
}

function next() {
  if (session.value && index.value < session.value.length) index.value++
}

function previous() {
  if (index.value > 0) index.value--
}

function finish() {
  practice.reset()
  speech.stop()
  session.value = null
}

function bubbleClass(role: DialogueRole | undefined) {
  return role === learnerRole.value ? 'bg-accented ms-auto' : 'bg-muted me-auto'
}

useShortcuts(
  'speak',
  () => t('shortcuts.groups.speak'),
  () => [
    {
      keys: ['m'],
      label: t('practice.recordLine'),
      run: () => void practice.record(),
      when: () => Boolean(item.value) && !appTurn.value && practice.recorder.supported.value,
    },
    {
      keys: ['s'],
      label: t('speak.listen'),
      run: () => speech.toggle(item.value?.text ?? '', item.value?.lang),
      when: () => Boolean(item.value) && speech.canSpeak(item.value?.lang),
    },
    { keys: ['arrowright'], label: t('speak.next'), run: next, when: () => Boolean(item.value) },
    {
      keys: ['arrowleft'],
      label: t('speak.previous'),
      run: previous,
      when: () => Boolean(item.value) && index.value > 0,
    },
  ],
)
</script>

<template>
  <div class="mx-auto w-full max-w-2xl space-y-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('speak.title') }}</h1>
      <p class="text-muted">{{ $t('speak.intro') }}</p>
    </header>

    <template v-if="!session">
      <section class="space-y-4" :aria-label="$t('speak.chooseSource')">
        <div class="flex flex-wrap gap-2" role="group" :aria-label="$t('speak.chooseSource')">
          <UButton
            v-for="option in SOURCES"
            :key="option.value"
            :icon="option.icon"
            :label="$t(`speak.sources.${option.value}`)"
            :aria-pressed="source === option.value"
            :color="source === option.value ? 'primary' : 'neutral'"
            :variant="source === option.value ? 'solid' : 'subtle'"
            @click="source = option.value"
          />
        </div>

        <div v-if="source === 'pack'" class="space-y-3">
          <p class="text-muted text-sm">{{ $t('speak.packHelp') }}</p>
          <div class="flex flex-wrap gap-3">
            <UFormField :label="$t('speak.pack')" name="speak-pack">
              <USelect v-model="packId" :items="packItems" class="w-64 max-w-full" />
            </UFormField>
            <UFormField :label="$t('speak.language')" name="speak-pack-language">
              <USelect v-model="packLang" :items="packLangItems" class="w-48 max-w-full" />
            </UFormField>
            <UFormField :label="isDialogue ? $t('speak.dialogue') : $t('speak.section')" name="speak-section">
              <USelect v-model="section" :items="sectionItems" class="w-56 max-w-full" />
            </UFormField>
            <UFormField v-if="isDialogue" :label="$t('speak.yourRole')" name="speak-role">
              <USelect v-model="learnerRole" :items="roleItems" class="w-48 max-w-full" />
            </UFormField>
          </div>
          <p v-if="isDialogue" class="text-muted text-sm">{{ $t('speak.dialogueHelp') }}</p>
          <PackTranslationNotice v-if="pack" :pack="pack" :languages="[packLang]" />
        </div>

        <div v-else-if="source === 'deck'" class="space-y-3">
          <p v-if="decksLoaded && !myDecks.length" class="text-muted text-sm">{{ $t('speak.noDecks') }}</p>
          <template v-else>
            <UFormField :label="$t('speak.deck')" name="speak-deck">
              <USelect v-model="deckRkey" :items="deckItems" :loading="!decksLoaded" class="w-72 max-w-full" />
            </UFormField>
            <p v-if="deck && !deck.value.targetLang" class="text-muted text-sm">{{ $t('speak.deckNoLanguage') }}</p>
            <ConversationHandoff v-if="deck" :deck="deck" :cards="deckCards" :progress="progress" />
          </template>
        </div>

        <div v-else class="space-y-3">
          <UFormField :label="$t('speak.yourText')" :description="$t('speak.textHelp')" name="speak-text">
            <UTextarea v-model="text" :rows="6" autoresize class="w-full" :lang="langAttr(textLang)" />
          </UFormField>
          <FileDrop accept=".txt,text/plain" @files="onFiles" />
          <UFormField :label="$t('speak.language')" name="speak-text-language">
            <USelect v-model="textLang" :items="languageItems" class="w-56 max-w-full" />
          </UFormField>
          <p class="text-muted text-xs">{{ $t('speak.textPrivacy') }}</p>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          :label="$t('speak.start')"
          icon="i-lucide-mic"
          size="lg"
          :disabled="items.length === 0"
          @click="start"
        />
        <span class="text-muted text-sm" role="status">
          {{ $t('speak.itemCount', { count: items.length }, items.length) }}
        </span>
      </div>
    </template>

    <section v-else-if="done" class="border-default space-y-4 rounded-2xl border border-dashed p-8 text-center">
      <UIcon name="i-lucide-party-popper" class="text-accent mx-auto size-10" aria-hidden="true" />
      <h2 class="text-lg font-semibold">{{ $t('speak.doneTitle') }}</h2>
      <p class="text-muted text-sm">
        {{ $t('speak.doneBody', { count: session.length }, session.length) }}
        <template v-if="average !== null">
          {{ $t('speak.doneAverage', { score: averageLabel }) }}
        </template>
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <UButton :label="$t('speak.again')" icon="i-lucide-rotate-ccw" @click="start" />
        <UButton :label="$t('speak.chooseOther')" color="neutral" variant="subtle" @click="finish" />
      </div>
    </section>

    <section v-else-if="item" class="space-y-5" :aria-label="$t('speak.session')">
      <div class="flex items-center gap-3">
        <UProgress :model-value="index" :max="session.length" size="sm" class="flex-1" aria-hidden="true" />
        <span class="text-muted text-sm tabular-nums">
          <span class="sr-only">{{ $t('a11y.sessionProgress') }}:</span>
          {{ index + 1 }}/{{ session.length }}
        </span>
        <UButton :label="$t('speak.end')" color="neutral" variant="ghost" size="sm" @click="finish" />
      </div>

      <ol v-if="history.length" class="space-y-2" :aria-label="$t('speak.conversationSoFar')">
        <li
          v-for="(line, i) in history"
          :key="i"
          class="w-fit max-w-[85%] rounded-2xl px-4 py-2 text-sm"
          :class="bubbleClass(line.role)"
        >
          <span class="sr-only">{{ line.role === learnerRole ? $t('speak.you') : $t('speak.partner') }}:</span>
          <span :lang="langAttr(line.lang)">{{ line.text }}</span>
        </li>
      </ol>

      <div class="border-default bg-muted space-y-3 rounded-2xl border p-6">
        <p v-if="dialogueSession" class="text-muted text-xs font-semibold tracking-wide uppercase">
          {{ appTurn ? $t('speak.partnerSays') : $t('speak.yourTurn') }}
        </p>
        <div class="flex items-center gap-2">
          <p class="min-w-0 flex-1 text-xl font-semibold text-balance" :lang="langAttr(item.lang)">{{ item.text }}</p>
          <SpeakButton :text="item.text" :lang="item.lang" keyshortcuts="S" />
        </div>
        <p v-if="item.reading" class="text-muted text-sm">{{ item.reading }}</p>
        <p v-if="item.translation" class="text-muted text-sm" :lang="langAttr(item.translationLang)">
          {{ item.translation }}
        </p>

        <template v-if="!appTurn">
          <UButton
            v-if="practice.recorder.supported.value"
            :icon="recording ? 'i-lucide-square' : 'i-lucide-mic'"
            :label="recording ? $t('practice.stopRecording') : $t('practice.start')"
            :color="recording ? 'error' : 'primary'"
            aria-keyshortcuts="M"
            @click="practice.record()"
          />
          <p v-else class="text-muted text-sm">{{ $t('practice.unsupported') }}</p>
          <PracticePanel :practice="practice" />
        </template>
      </div>

      <div class="flex justify-between gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          :label="$t('speak.previous')"
          color="neutral"
          variant="ghost"
          :disabled="index === 0"
          aria-keyshortcuts="ArrowLeft"
          @click="previous"
        />
        <UButton
          trailing-icon="i-lucide-chevron-right"
          :label="index + 1 === session.length ? $t('speak.finish') : appTurn ? $t('speak.reply') : $t('speak.next')"
          aria-keyshortcuts="ArrowRight"
          @click="next"
        />
      </div>
    </section>
  </div>
</template>
