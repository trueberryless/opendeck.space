<script setup lang="ts">
import type { Visibility } from '~/utils/records'
import { authReady } from '~/composables/useAirspace'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t, te } = useI18n()
const authUser = useAuthUser()
const isLoggedIn = useIsLoggedIn()
const toast = useToast()

const { get } = useStarterPacks()
const { supported, ensure } = useSpacesSupport()
const { prefs } = useProfile()
const { progress, runImport, reset } = useImport()

const pack = computed(() => get(route.params.id as string))

function langName(code: string): string {
  return te(`languages.${code}`) ? t(`languages.${code}`) : code.toUpperCase()
}

const from = ref('')
const to = ref('')

watchEffect(() => {
  const p = pack.value
  if (!p || p.languages.length === 0) return
  if (!p.languages.includes(from.value)) {
    from.value = p.languages.includes('en') ? 'en' : p.languages[0]!
  }
  if (!p.languages.includes(to.value) || to.value === from.value) {
    to.value = p.languages.find((l) => l !== from.value) ?? p.languages[0]!
  }
})

const languageItems = computed(() =>
  (pack.value?.languages ?? []).map((code) => ({ label: langName(code), value: code })),
)

const sameLanguage = computed(() => from.value === to.value)

const packName = computed(() => (pack.value ? t(`packs.${pack.value.id}.name`) : ''))
const packSummary = computed(() => (pack.value ? t(`packs.${pack.value.id}.description`) : ''))

const cards = computed(() => (pack.value ? buildPackCards(pack.value, from.value, to.value) : []))
const sections = computed(() => (pack.value ? groupPackCards(pack.value.sections, cards.value) : []))

function sectionLabel(section: string): string {
  const key = `packs.${pack.value?.id}.sections.${section}`
  return te(key) ? t(key) : section
}

useHead(() => ({ title: pack.value ? `${packName.value} · OpenDeck` : `${t('starter.title')} · OpenDeck` }))

const visibility = ref<Visibility>('public')
const adding = ref(false)

const selfActor = computed(() => authUser.value?.handle || authUser.value?.did || '')
const createdRkey = computed(() => progress.value.created[0]?.rkey ?? null)
const done = computed(() => progress.value.status === 'done' && createdRkey.value)
const statusText = computed(() => {
  if (done.value) return t('starter.added')
  if (progress.value.status === 'paused') return t('starter.pausedRate')
  if (adding.value || progress.value.status === 'running') return t('starter.adding')
  return ''
})
const pct = computed(() =>
  progress.value.totalCards ? Math.round((progress.value.doneCards / progress.value.totalCards) * 100) : 0,
)

onMounted(async () => {
  reset()
  await authReady
  if (await ensure()) visibility.value = prefs.value?.defaultVisibility ?? 'private'
})

function swap() {
  const f = from.value
  from.value = to.value
  to.value = f
}

async function add() {
  if (!pack.value || sameLanguage.value || adding.value) return
  adding.value = true
  try {
    const deck = packToParsedDeck(pack.value, from.value, to.value, packName.value, packSummary.value)
    await runImport([deck], visibility.value)
    if (progress.value.status === 'done') {
      toast.add({ title: t('starter.addedToast'), color: 'success' })
    } else if (progress.value.status === 'error') {
      toast.add({ title: t('starter.addError'), description: progress.value.errors.join(' '), color: 'error' })
    }
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <UButton
      to="/discover"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      :label="$t('starter.title')"
    />

    <div v-if="!pack" class="border-default rounded-lg border border-dashed p-10 text-center">
      <UIcon name="i-lucide-search-x" class="text-muted mx-auto size-8" />
      <p class="mt-3 font-medium">{{ $t('starter.packNotFound') }}</p>
      <p class="text-muted mt-1 text-sm">{{ $t('starter.packNotFoundBody') }}</p>
    </div>

    <template v-else>
      <header class="space-y-2">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold tracking-tight">{{ packName }}</h1>
          <span v-if="pack.verified" class="shrink-0">
            <UIcon name="i-lucide-badge-check" class="text-accent size-5" aria-hidden="true" />
            <span class="sr-only">{{ $t('starter.verified') }}</span>
          </span>
        </div>
        <p class="text-sm text-neutral-600 dark:text-neutral-300">{{ packSummary }}</p>
      </header>

      <section class="border-default rounded-lg border p-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField :label="$t('starter.iKnow')">
            <USelect v-model="from" :items="languageItems" class="w-full" />
          </UFormField>
          <UFormField :label="$t('starter.iWantToLearn')">
            <USelect v-model="to" :items="languageItems" class="w-full" />
          </UFormField>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3">
          <UButton
            icon="i-lucide-arrow-left-right"
            color="neutral"
            variant="ghost"
            size="sm"
            :label="$t('starter.swap')"
            @click="swap"
          />
          <span class="text-muted text-xs">{{
            $t('starter.entriesCount', { count: cards.length }, cards.length)
          }}</span>
        </div>
      </section>

      <UAlert
        v-if="sameLanguage"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="$t('starter.sameLanguageTitle')"
        :description="$t('starter.sameLanguageBody')"
      />

      <section v-else class="border-default rounded-lg border p-4">
        <p class="sr-only" role="status">{{ statusText }}</p>
        <template v-if="done">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm font-medium">{{ $t('starter.added') }}</p>
            <UButton
              :to="deckPath(selfActor, createdRkey!)"
              :label="$t('starter.openDeck')"
              icon="i-lucide-arrow-right"
              trailing
              size="sm"
            />
          </div>
        </template>

        <template v-else-if="adding || progress.status === 'running' || progress.status === 'paused'">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-medium">
              <template v-if="progress.status === 'paused'">{{ $t('starter.pausedRate') }}</template>
              <template v-else>{{ $t('starter.adding') }}</template>
            </p>
            <span class="text-muted text-sm">{{ progress.doneCards }}/{{ progress.totalCards }}</span>
          </div>
          <UProgress :model-value="pct" :max="100" aria-hidden="true" />
          <p v-if="progress.status === 'paused'" class="text-warning mt-2 text-xs">
            {{ $t('starter.waitingRate', { seconds: progress.pauseSeconds }) }}
          </p>
        </template>

        <template v-else-if="isLoggedIn">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <UFormField v-if="supported" :label="$t('deckEditor.visibility')">
              <div class="flex gap-2">
                <UButton
                  :aria-pressed="visibility === 'public'"
                  :color="visibility === 'public' ? 'primary' : 'neutral'"
                  :variant="visibility === 'public' ? 'solid' : 'subtle'"
                  icon="i-lucide-globe"
                  :label="$t('visibility.public')"
                  size="sm"
                  @click="visibility = 'public'"
                />
                <UButton
                  :aria-pressed="visibility === 'private'"
                  :color="visibility === 'private' ? 'primary' : 'neutral'"
                  :variant="visibility === 'private' ? 'solid' : 'subtle'"
                  icon="i-lucide-lock"
                  :label="$t('visibility.private')"
                  size="sm"
                  @click="visibility = 'private'"
                />
              </div>
            </UFormField>
            <p v-else class="text-muted text-sm">{{ $t('starter.savedToRepo') }}</p>
            <UButton :label="$t('starter.addToMyDecks')" icon="i-lucide-plus" size="lg" @click="add" />
          </div>
          <UAlert
            v-if="progress.status === 'error'"
            class="mt-3"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :description="progress.errors.join(' ')"
          />
        </template>

        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-muted text-sm">{{ $t('starter.signInToAdd') }}</p>
            <UButton to="/login" :label="$t('common.signIn')" icon="i-lucide-log-in" size="sm" />
          </div>
        </template>
      </section>

      <section v-if="!sameLanguage" class="space-y-5">
        <h2 class="text-muted text-sm font-medium">{{ $t('starter.preview') }}</h2>
        <div v-for="group in sections" :key="group.section" class="space-y-2">
          <h3 class="text-muted text-xs font-semibold tracking-wide uppercase">
            {{ sectionLabel(group.section) }}
          </h3>
          <ul class="divide-default border-default divide-y overflow-hidden rounded-lg border">
            <li v-for="(card, i) in group.cards" :key="i" class="flex items-baseline gap-4 p-3 text-sm">
              <span class="min-w-0 flex-1 text-neutral-600 dark:text-neutral-300" :lang="langAttr(from)">
                {{ card.front }}
                <span v-if="card.frontReading" class="text-muted block text-xs">{{ card.frontReading }}</span>
              </span>
              <span class="min-w-0 flex-1 text-end font-medium" :lang="langAttr(to)">
                {{ card.back }}
                <span v-if="card.reading" class="text-muted block text-xs font-normal">{{ card.reading }}</span>
              </span>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
