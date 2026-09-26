<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getBskyProfiles, resolveDid, type BskyProfile } from '~/utils/bsky'
import { challengeStatus, daysLeft, entryDays, standings } from '~/utils/challenges'
import type { ChallengeView, EntryView } from '~/composables/useChallenges'

definePageMeta({ middleware: 'auth' })
const { t, locale } = useI18n()
const route = useRoute()
const challenges = useChallenges()
const motivation = useMotivation()
const authUser = useAuthUser()
const reauth = useReauth()
const { canShare, copy, share } = useShareLink()

const challenge = ref<ChallengeView | null>(null)
const entries = ref<EntryView[]>([])
const profiles = ref(new Map<string, BskyProfile>())
const loading = ref(true)
const busy = ref(false)

const me = computed(() => authUser.value?.did)
const myEntry = computed(() => entries.value.find((e) => e.did === me.value) ?? null)
const isOwner = computed(() => challenge.value?.did === me.value)
const status = computed(() => (challenge.value ? challengeStatus(challenge.value.value) : 'running'))
const left = computed(() => (challenge.value ? daysLeft(challenge.value.value) : 0))

const rows = computed(() => {
  const c = challenge.value
  if (!c) return []
  const studied = motivation.studied.value
  return standings(
    c.value,
    entries.value.map((e) => ({
      did: e.did,
      days: e.did === me.value && studied ? entryDays(c.value, studied) : e.value.days,
    })),
  )
})

const winners = computed(() => {
  if (status.value !== 'ended') return ''
  const names = rows.value
    .filter((r) => r.rank === 1)
    .map((r) => profiles.value.get(r.did)?.displayName || profiles.value.get(r.did)?.handle || r.did)
  return new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(names)
})

const range = computed(() => {
  if (!challenge.value) return ''
  const format = new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' })
  const end = new Date(new Date(challenge.value.value.endsAt).getTime() - 1)
  return format.formatRange(new Date(challenge.value.value.startsAt), end)
})

const link = computed(() =>
  challenge.value && import.meta.client
    ? `${window.location.origin}${challengePath(route.params.handle as string, challenge.value.rkey)}`
    : '',
)

useHead(() => ({ title: `${challenge.value?.value.title ?? t('challenges.title')} · OpenDeck` }))

async function loadEntries() {
  if (!challenge.value) return
  entries.value = await challenges.participants(challenge.value)
  const found = await getBskyProfiles(entries.value.map((e) => e.did)).catch(() => [])
  profiles.value = new Map(found.map((p) => [p.did, p]))
}

async function load() {
  loading.value = true
  try {
    const did = await resolveDid(route.params.handle as string)
    challenge.value = did ? await challenges.get(did, route.params.rkey as string) : null
    await loadEntries()
  } finally {
    loading.value = false
  }
}

async function act(action: () => Promise<unknown>, error: string) {
  busy.value = true
  try {
    await action()
  } catch (err) {
    reauth.report(err, error)
  } finally {
    busy.value = false
  }
}

function join() {
  return act(async () => {
    const entry = await challenges.join(challenge.value!)
    entries.value = [...entries.value.filter((e) => e.did !== entry.did), entry]
    await loadEntries()
  }, t('challenges.joinError'))
}

function leave() {
  return act(async () => {
    await challenges.leave(myEntry.value!)
    entries.value = entries.value.filter((e) => e.did !== me.value)
  }, t('challenges.leaveError'))
}

function remove() {
  return act(async () => {
    await challenges.remove(challenge.value!)
    await navigateTo('/together')
  }, t('challenges.deleteError'))
}

onMounted(load)
watch(() => [route.params.handle, route.params.rkey], load)
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <UButton
      to="/together"
      icon="i-lucide-arrow-left"
      :label="$t('together.title')"
      color="neutral"
      variant="ghost"
      size="sm"
    />

    <div v-if="loading" class="space-y-3">
      <USkeleton class="h-8 w-2/3" />
      <USkeleton class="h-40 w-full" />
    </div>

    <UAlert
      v-else-if="!challenge"
      icon="i-lucide-search-x"
      :title="$t('challenges.notFound')"
      :description="$t('challenges.notFoundBody')"
      color="neutral"
      variant="subtle"
    />

    <template v-else>
      <header class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            :label="$t(`challenges.kinds.${challenge.value.kind}`)"
            :icon="challenge.value.kind === 'everyDay' ? 'i-lucide-flame' : 'i-lucide-calendar-check'"
            color="neutral"
            variant="subtle"
          />
          <span class="text-muted text-sm">
            {{ range }} ·
            {{ status === 'ended' ? $t('challenges.ended') : $t('challenges.daysLeft', { count: left }, left) }}
          </span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight wrap-break-word">{{ challenge.value.title }}</h1>
        <p class="text-muted text-sm">{{ $t(`challenges.kinds.${challenge.value.kind}Body`) }}</p>
      </header>

      <div v-if="winners" class="bg-accent flex items-center gap-3 rounded-xl p-4 font-semibold" role="status">
        <UIcon name="i-lucide-trophy" class="tier-float size-7 shrink-0" aria-hidden="true" />
        {{ $t('challenges.winner', { names: winners }) }}
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="!myEntry && status !== 'ended'"
          :label="$t('challenges.join')"
          icon="i-lucide-user-plus"
          :loading="busy"
          @click="join"
        />
        <UButton
          :label="canShare ? $t('together.share') : $t('together.copyLink')"
          :icon="canShare ? 'i-lucide-share-2' : 'i-lucide-link'"
          color="neutral"
          variant="subtle"
          @click="canShare ? share(link, challenge.value.title) : copy(link)"
        />
        <ConfirmPopover
          v-if="myEntry && !isOwner"
          :title="$t('challenges.leaveConfirm')"
          :description="$t('challenges.leaveBody')"
          :confirm-label="$t('challenges.leave')"
          @confirm="leave"
        >
          <UButton :label="$t('challenges.leave')" color="neutral" variant="ghost" :disabled="busy" />
        </ConfirmPopover>
        <ConfirmPopover
          v-if="isOwner"
          :title="$t('challenges.deleteConfirm')"
          :description="$t('challenges.deleteBody')"
          :confirm-label="$t('common.delete')"
          @confirm="remove"
        >
          <UButton
            :label="$t('challenges.delete')"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            :disabled="busy"
          />
        </ConfirmPopover>
      </div>
      <p v-if="!myEntry && status !== 'ended'" class="text-muted text-xs">{{ $t('challenges.joinNote') }}</p>

      <section class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ $t('challenges.participants', { count: rows.length }, rows.length) }}
        </h2>
        <ChallengeStandings
          :rows="rows"
          :kind="challenge.value.kind"
          :profiles="profiles"
          :me="me"
          :ended="status === 'ended'"
        />
      </section>
    </template>
  </div>
</template>
