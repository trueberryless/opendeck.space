<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import en from '~~/i18n/en.json'
import {
  CHECK_TEMPLATE,
  englishLanguageName,
  FIX_TEMPLATE,
  type Fluency,
  formatReview,
  issueUrl,
  MAX_ISSUE_URL_LENGTH,
  placeholders,
  pluralFormCount,
  REVIEW_FIELD,
  samePlaceholders,
  SOURCE_LANGUAGE,
  pendingKeys,
  reviewableStrings,
  type TranslationReview,
  type TranslationVerification,
} from '~~/shared/translations'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const { current } = useLocale()
const { list } = useStarterPacks()
const commit = useRuntimeConfig().public.commit as string
useHead(() => ({ title: `${t('translations.review.title')} | OpenDeck` }))

const packs = list()
const packNames = en.packs as Record<string, { name: string }>

function languageName(code: string): string {
  return LOCALES.find((l) => l.code === code)?.name ?? (te(`languages.${code}`) ? t(`languages.${code}`) : code)
}

const languageItems = computed(() =>
  [...new Set([...LOCALES.map((l) => l.code), ...packs.flatMap((p) => p.languages)])]
    .filter((code) => code !== SOURCE_LANGUAGE)
    .map((code) => ({ label: languageName(code), value: code }))
    .sort((a, b) => a.label.localeCompare(b.label, current.value)),
)

const language = computed<string | undefined>({
  get: () => {
    const code = typeof route.query.lang === 'string' ? route.query.lang : undefined
    return languageItems.value.some((i) => i.value === code) ? code : undefined
  },
  set: (code) => router.replace({ query: { ...route.query, lang: code, file: undefined } }),
})

const fileItems = computed(() => {
  const code = language.value
  if (!code) return []
  return [
    ...(LOCALES.some((l) => l.code === code) ? [{ label: t('translations.interface'), value: 'ui' }] : []),
    ...packs
      .filter((p) => p.languages.includes(code))
      .map((p) => ({ label: t(`packs.${p.id}.name`), value: p.id }))
      .sort((a, b) => a.label.localeCompare(b.label, current.value)),
  ]
})

const scope = computed<string | undefined>({
  get: () => {
    const file = typeof route.query.file === 'string' ? route.query.file : undefined
    return fileItems.value.find((i) => i.value === file)?.value ?? fileItems.value[0]?.value
  },
  set: (file) => router.replace({ query: { ...route.query, file } }),
})

const pack = computed(() => (scope.value && scope.value !== 'ui' ? packs.find((p) => p.id === scope.value) : undefined))
const targetLang = computed(() => langAttr(language.value))
const targetDir = computed(() => (language.value ? localeDir(language.value) : 'ltr'))

interface LoadedFile {
  code: string
  file: string
  english: Map<string, string>
  target: Map<string, string>
  checks: TranslationVerification[]
}

const loaded = shallowRef<LoadedFile>()
const mode = ref<ReviewMode>('all')
const sections = ref<ReviewSection[]>([])
const progress = ref<ReviewProgress>({ fingerprint: '', edits: {}, confirmed: [], read: {} })
const loading = ref(false)
let storageKey = ''

const pending = computed(() => {
  const file = loaded.value
  if (!file) return new Set<string>()
  return new Set(pendingKeys(reviewableStrings(file.english, file.target), file.checks))
})
const everChecked = computed(() => new Set(loaded.value?.checks.flatMap((c) => Object.keys(c.strings ?? {})) ?? []))
const hasChecks = computed(() => Boolean(loaded.value?.checks.length))
const totalStrings = computed(() => {
  const file = loaded.value
  return file ? reviewableStrings(file.english, file.target).size : 0
})

function readProgress(key: string): ReviewProgress | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as ReviewProgress) : undefined
  } catch {
    return undefined
  }
}

watch(
  [language, scope],
  async ([code, file]) => {
    loaded.value = undefined
    if (!import.meta.client || !code || !file) return
    loading.value = true
    const [strings, checks] = await Promise.all([
      loadReviewStrings(file, code, pack.value),
      loadReviewChecks(file, code),
    ])
    loading.value = false
    if (!strings || code !== language.value || file !== scope.value) return
    const next = { code, file, ...strings, checks }
    const open = pendingKeys(reviewableStrings(next.english, next.target), checks).length
    mode.value = checks.length && open > 0 ? 'changes' : 'all'
    loaded.value = next
  },
  { immediate: true },
)

watch([loaded, mode], ([file, selected]) => {
  sections.value = []
  storageKey = ''
  if (!file) return
  const next = reviewSections(file.english, file.target, pack.value, selected === 'changes' ? pending.value : undefined)
  const fingerprint = reviewFingerprint(next)
  const keys = new Set(next.flatMap((s) => s.rows.map((r) => r.key)))
  const key = reviewStorageKey(file.code, file.file, selected)
  const saved = readProgress(key)
  const edits = Object.fromEntries(Object.entries(saved?.edits ?? {}).filter(([k]) => keys.has(k)))
  progress.value =
    saved?.fingerprint === fingerprint
      ? { ...saved, edits }
      : { fingerprint, edits, confirmed: [], read: {}, fluency: saved?.fluency }
  sections.value = next
  storageKey = key
})

function rowBadge(row: ReviewRow): string | undefined {
  if (!hasChecks.value || !pending.value.has(row.key)) return undefined
  return everChecked.value.has(row.key) ? t('translations.review.changed') : t('translations.review.new')
}

watch(
  progress,
  (value) => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {}
  },
  { deep: true },
)

const rowCount = computed(() => sections.value.reduce((sum, s) => sum + s.rows.length, 0))
const confirmedCount = computed(() => sections.value.filter((s) => progress.value.confirmed.includes(s.id)).length)
const currentSection = computed(() => sections.value.find((s) => !progress.value.confirmed.includes(s.id)))
const allConfirmed = computed(() => sections.value.length > 0 && !currentSection.value)
const changeCount = computed(() => Object.keys(progress.value.edits).length)

function sectionTitle(section: ReviewSection): string {
  return pack.value ? t(`packs.${pack.value.id}.sections.${section.group}`) : section.group
}

function displayKey(key: string): string {
  return pack.value
    ? key
        .replace(/^entries\./, '')
        .replace(/\.text$/, '')
        .replace(/\.(\w+)$/, ' · $1')
    : key
}

function valueOf(row: ReviewRow): string {
  return progress.value.edits[row.key] ?? row.value
}

function setValue(row: ReviewRow, value: string) {
  const { [row.key]: _, ...rest } = progress.value.edits
  progress.value.edits = value === row.value ? rest : { ...rest, [row.key]: value }
}

const pluralForms = computed(() => (language.value ? pluralCategories(language.value).length : 1))

function rowError(row: ReviewRow): string | undefined {
  const value = progress.value.edits[row.key]
  if (value === undefined) return undefined
  if (!value.trim()) return t('translations.review.empty')
  if (!samePlaceholders(row.source, value)) {
    return t('translations.review.placeholders', { list: placeholders(row.source).join(' ') || '–' })
  }
  if (scope.value === 'ui' && pluralFormCount(value) !== 1 && pluralFormCount(value) !== pluralForms.value) {
    return t('translations.review.pluralForms', { count: pluralForms.value })
  }
  return undefined
}

const hasErrors = computed(() => sections.value.some((s) => s.rows.some((r) => rowError(r))))

function remainingSeconds(section: ReviewSection): number {
  return Math.max(0, requiredSeconds(section) - Math.floor((progress.value.read[section.id] ?? 0) / 1000))
}

const sectionEls = ref<Record<string, HTMLElement>>({})
const currentVisible = ref(false)
let observer: IntersectionObserver | undefined
let timer: ReturnType<typeof setInterval> | undefined

watch(
  () => currentSection.value && sectionEls.value[currentSection.value.id],
  (el) => {
    observer?.disconnect()
    currentVisible.value = false
    if (el) observer?.observe(el)
  },
  { flush: 'post' },
)

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) currentVisible.value = entry.isIntersecting
  })
  const el = currentSection.value && sectionEls.value[currentSection.value.id]
  if (el) observer.observe(el)
  timer = setInterval(() => {
    const section = currentSection.value
    if (!section || !currentVisible.value || document.visibilityState !== 'visible') return
    if (remainingSeconds(section) === 0) return
    progress.value.read = { ...progress.value.read, [section.id]: (progress.value.read[section.id] ?? 0) + 1000 }
  }, 1000)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  clearInterval(timer)
})

async function confirm(section: ReviewSection) {
  progress.value.confirmed = [...progress.value.confirmed, section.id]
  await nextTick()
  const next = currentSection.value && sectionEls.value[currentSection.value.id]
  next?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function reopen(section: ReviewSection) {
  progress.value.confirmed = progress.value.confirmed.filter((id) => id !== section.id)
}

const fluency = computed<Fluency | undefined>({
  get: () => progress.value.fluency,
  set: (value) => {
    progress.value.fluency = value
  },
})

const fluencyItems = computed(() => [
  { label: t('translations.review.native'), value: 'native' },
  { label: t('translations.review.fluent'), value: 'fluent' },
])

const copied = ref(false)

async function send(approve: boolean) {
  if (!language.value || !scope.value) return
  const review: TranslationReview = {
    language: language.value,
    scope: scope.value,
    commit,
    ...(approve && fluency.value ? { fluency: fluency.value } : {}),
    ...(mode.value === 'changes' ? { keys: sections.value.flatMap((s) => s.rows.map((r) => r.key)) } : {}),
    changes: progress.value.edits,
  }
  const english = englishLanguageName(language.value, LOCALES, en.languages)
  const file = scope.value === 'ui' ? 'interface' : `${packNames[scope.value]?.name ?? scope.value} pack`
  const fields = {
    title: `[translation]: ${approve ? 'review' : 'fix'} ${english} ${file}`,
    ...(approve ? {} : { language: `${english} (${language.value})` }),
  }
  const template = approve ? CHECK_TEMPLATE : FIX_TEMPLATE
  const text = formatReview(review)
  let url = issueUrl(template, { ...fields, [REVIEW_FIELD]: text })
  copied.value = false
  if (url.length > MAX_ISSUE_URL_LENGTH) {
    url = issueUrl(template, fields)
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
    } catch {}
  }
  window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <div class="max-w-5xl py-8">
    <NuxtLink to="/translations" class="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:underline">
      <UIcon name="i-lucide-arrow-left" class="size-4 rtl:rotate-180" aria-hidden="true" />
      {{ $t('translations.title') }}
    </NuxtLink>
    <h1 class="mb-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('translations.review.title') }}
    </h1>
    <p class="mb-4 max-w-3xl leading-relaxed text-neutral-700 dark:text-neutral-300">
      {{ $t('translations.review.intro') }}
    </p>
    <ul class="text-muted mb-6 max-w-3xl space-y-1.5 text-sm">
      <li class="flex items-start gap-2">
        <UIcon name="i-lucide-github" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {{ $t('translations.review.account') }}
      </li>
      <li class="flex items-start gap-2">
        <UIcon name="i-lucide-save" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {{ $t('translations.review.saved') }}
      </li>
    </ul>

    <div class="mb-8 flex flex-wrap gap-4">
      <UFormField :label="$t('translations.language')" class="w-full sm:w-64">
        <USelectMenu
          v-model="language"
          :items="languageItems"
          value-key="value"
          :placeholder="$t('translations.review.chooseLanguage')"
          class="w-full"
        />
      </UFormField>
      <UFormField v-if="language" :label="$t('translations.review.file')" class="w-full sm:w-64">
        <USelectMenu v-model="scope" :items="fileItems" value-key="value" class="w-full" />
      </UFormField>
    </div>

    <ClientOnly>
      <p v-if="!language" class="text-muted">{{ $t('translations.review.chooseLanguage') }}</p>
      <div v-else-if="loading" class="text-muted flex items-center gap-2">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
      </div>
      <template v-else-if="loaded">
        <div v-if="hasChecks" class="mb-6 space-y-3">
          <p v-if="pending.size === 0" class="text-success flex items-center gap-2 text-sm">
            <UIcon name="i-lucide-badge-check" class="size-4 shrink-0" aria-hidden="true" />
            {{ $t('translations.review.upToDate') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              :label="$t('translations.review.scopeChanges', { count: pending.size })"
              :variant="mode === 'changes' ? 'solid' : 'outline'"
              :color="mode === 'changes' ? 'primary' : 'neutral'"
              :aria-pressed="mode === 'changes'"
              :disabled="pending.size === 0"
              size="sm"
              @click="mode = 'changes'"
            />
            <UButton
              :label="$t('translations.review.scopeAll', { count: totalStrings })"
              :variant="mode === 'all' ? 'solid' : 'outline'"
              :color="mode === 'all' ? 'primary' : 'neutral'"
              :aria-pressed="mode === 'all'"
              size="sm"
              @click="mode = 'all'"
            />
          </div>
        </div>
        <div
          class="border-default sticky top-[env(safe-area-inset-top)] z-10 -mx-2 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-(--ui-bg)/90 px-2 py-3 backdrop-blur md:top-[calc(65px+env(safe-area-inset-top))]"
        >
          <div class="min-w-48 flex-1">
            <p class="mb-1 text-sm font-medium">
              {{ $t('translations.review.progress', { done: confirmedCount, total: sections.length }) }}
            </p>
            <UProgress :model-value="confirmedCount" :max="sections.length" size="sm" aria-hidden="true" />
          </div>
          <p class="text-muted text-sm tabular-nums">
            {{ $t('translations.review.strings', { count: rowCount }) }} ·
            {{ $t('translations.review.changes', { count: changeCount }) }}
          </p>
        </div>

        <div class="space-y-4">
          <section
            v-for="section in sections"
            :key="section.id"
            :ref="(el) => el && (sectionEls[section.id] = el as HTMLElement)"
            class="border-default scroll-mt-24 rounded-lg border md:scroll-mt-40"
            :aria-labelledby="`section-${section.id}`"
          >
            <header class="flex flex-wrap items-center gap-3 px-4 py-3">
              <UIcon
                v-if="progress.confirmed.includes(section.id)"
                name="i-lucide-circle-check"
                class="text-success size-5 shrink-0"
                aria-hidden="true"
              />
              <h2 :id="`section-${section.id}`" class="font-semibold" :class="pack ? '' : 'font-mono text-sm'">
                {{ sectionTitle(section) }}
                <span v-if="section.parts > 1" class="text-muted font-sans font-normal">
                  {{ section.part }}/{{ section.parts }}
                </span>
              </h2>
              <UButton
                v-if="progress.confirmed.includes(section.id)"
                :label="$t('translations.review.reopen')"
                color="neutral"
                variant="ghost"
                size="xs"
                class="ms-auto"
                @click="reopen(section)"
              />
            </header>

            <template v-if="!progress.confirmed.includes(section.id)">
              <ul class="divide-default border-default divide-y border-t">
                <li
                  v-for="row in section.rows"
                  :key="row.key"
                  class="grid gap-2 px-4 py-3 md:grid-cols-2 md:gap-6"
                  :class="progress.edits[row.key] !== undefined ? 'bg-(--accent)/5' : ''"
                >
                  <div class="min-w-0">
                    <p class="mb-1 flex flex-wrap items-center gap-2">
                      <span class="text-muted font-mono text-xs break-all">{{ displayKey(row.key) }}</span>
                      <UBadge v-if="rowBadge(row)" :label="rowBadge(row)" color="warning" variant="subtle" size="sm" />
                    </p>
                    <p lang="en" dir="ltr" class="text-sm break-words whitespace-pre-wrap">
                      <span v-if="row.reading" class="text-muted">{{ $t('translations.review.reading') }}: </span
                      >{{ row.source }}
                    </p>
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-start gap-1">
                      <UTextarea
                        :model-value="valueOf(row)"
                        :lang="targetLang"
                        :dir="targetDir"
                        :rows="1"
                        autoresize
                        :color="rowError(row) ? 'error' : 'primary'"
                        :highlight="Boolean(rowError(row))"
                        :aria-label="row.key"
                        class="w-full"
                        @update:model-value="(v: string) => setValue(row, v)"
                      />
                      <UButton
                        v-if="progress.edits[row.key] !== undefined"
                        icon="i-lucide-undo-2"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        :aria-label="$t('translations.review.undo')"
                        @click="setValue(row, row.value)"
                      />
                    </div>
                    <p v-if="rowError(row)" class="text-error mt-1 text-xs">{{ rowError(row) }}</p>
                  </div>
                </li>
              </ul>
              <footer class="border-default flex flex-wrap items-center justify-end gap-3 border-t px-4 py-3">
                <template v-if="section.id === currentSection?.id">
                  <UButton
                    :label="
                      remainingSeconds(section)
                        ? $t('translations.review.keepReading', { seconds: remainingSeconds(section) })
                        : $t('translations.review.confirm')
                    "
                    icon="i-lucide-check"
                    :disabled="remainingSeconds(section) > 0"
                    @click="confirm(section)"
                  />
                </template>
                <p v-else class="text-muted text-sm">{{ $t('translations.review.confirmAbove') }}</p>
              </footer>
            </template>
          </section>
        </div>

        <section class="border-default bg-muted mt-8 rounded-lg border p-5">
          <URadioGroup
            v-model="fluency"
            :legend="$t('translations.review.fluency')"
            :items="fluencyItems"
            class="mb-5"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-badge-check"
              :label="$t('translations.review.approve')"
              :disabled="!allConfirmed || !fluency || hasErrors || !commit"
              @click="send(true)"
            />
            <UButton
              icon="i-lucide-send"
              :label="$t('translations.review.sendChanges')"
              color="neutral"
              variant="subtle"
              :disabled="changeCount === 0 || hasErrors || !commit"
              @click="send(false)"
            />
          </div>
          <p v-if="!allConfirmed" class="text-muted mt-3 text-sm">{{ $t('translations.review.approveLocked') }}</p>
          <p class="text-muted mt-3 text-sm leading-relaxed">{{ $t('translations.review.submitHint') }}</p>
          <UAlert
            v-if="copied"
            class="mt-4"
            color="warning"
            variant="subtle"
            icon="i-lucide-clipboard-check"
            :description="$t('translations.review.copied')"
          />
        </section>
      </template>
    </ClientOnly>
  </div>
</template>
