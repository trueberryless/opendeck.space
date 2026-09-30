<script setup lang="ts">
import type { OpenDeckPrefs } from '~/utils/records'
import { authReady } from '~/composables/useAirspace'
import type { DeckView } from '~/composables/useDecks'
import { useI18n } from 'vue-i18n'
import { getBskyProfile, type BskyProfile } from '~/utils/bsky'
import { publishedTier, summarizeTier, tierRank, unpackStudyDays } from '~/utils/tiers'
import { motivationShownTo } from '~/composables/useMotivation'
import { fromPublicStats } from '~/utils/stats'
import { parseDevRoles, parseDevTier, type DevTier } from '~/utils/devTheme'
import type { Role } from '~~/shared/credits'
import { creditsFor, type Credit, type CreditStyle } from '~/utils/credits'

const { t } = useI18n()
const route = useRoute()
const authUser = useAuthUser()
const isLoggedIn = useIsLoggedIn()
const decks = useDecks()
const social = useSocial()
const { stats, load: loadStats } = useStats()
const toast = useToast()

const handle = computed(() => route.params.handle as string)

const profile = ref<BskyProfile | null>(null)
const viewerPrefs = ref<OpenDeckPrefs | null>(null)
const did = ref<string | null>(null)
const followingCount = ref(0)
const followersCount = ref<number | null>(null)
const userDecks = ref<DeckView[]>([])
const followRkey = ref<string | null>(null)
const loading = ref(true)
const notFound = ref(false)

const isSelf = computed(() => Boolean(did.value && authUser.value?.did === did.value))
const isFollowing = computed(() => followRkey.value !== null)
const { prefs } = useProfile()

const isDev = import.meta.dev
const DevThemePicker = import.meta.dev ? defineAsyncComponent(() => import('~/components/DevThemePicker.vue')) : null
const devVisitor = ref(isDev && route.query.as === 'visitor')
const devTier = ref<DevTier>(isDev ? parseDevTier(route.query.tier) : null)
const devRoles = ref<Role[] | null>(isDev ? parseDevRoles(route.query.roles) : null)

const ownView = computed(() => isSelf.value && !devVisitor.value)
const publicPrefs = computed(() => (isSelf.value ? prefs.value : viewerPrefs.value))
const decksPublic = computed(() => Boolean(publicPrefs.value?.showDecksOnProfile))
const showDecks = computed(() => ownView.value || decksPublic.value)
const followsPublic = computed(() => Boolean(publicPrefs.value?.showFollowsOnProfile))
const showFollowing = computed(() => ownView.value || followsPublic.value)
const motivation = useMotivation()

const statsShownTo = computed(() => publicPrefs.value?.showStats ?? DEFAULT_PREFS.showStats)
const visitorStats = computed(() =>
  !ownView.value && statsShownTo.value === 'everyone' ? fromPublicStats(publicPrefs.value?.publicStats) : null,
)
const shownStats = computed(() => {
  if (!ownView.value) return visitorStats.value
  return statsShownTo.value === 'nobody' ? null : stats.value
})
const loadOwnStats = computed(() => ownView.value && statsShownTo.value !== 'nobody')

const creditsShownTo = computed(() => publicPrefs.value?.showCredits ?? DEFAULT_PREFS.showCredits)
const creditStyle = computed<CreditStyle>(() => publicPrefs.value?.creditStyle ?? DEFAULT_PREFS.creditStyle)
const shownCredits = computed<Credit[]>(() => {
  if (devRoles.value) return devRoles.value.map((role) => ({ role }))
  const visible = ownView.value ? creditsShownTo.value !== 'nobody' : creditsShownTo.value === 'everyone'
  return did.value && visible ? creditsFor(did.value) : []
})
const leadRole = computed(() =>
  devRoles.value || creditStyle.value === 'theme' ? (shownCredits.value[0]?.role ?? null) : null,
)

const tierShownTo = computed(() => publicPrefs.value?.showTier ?? DEFAULT_PREFS.showTier)
const motivationShown = computed(() => motivationShownTo(publicPrefs.value))
const visitorSummary = computed(() => {
  const p = publicPrefs.value
  if (ownView.value || motivationShown.value !== 'everyone') return null
  if (isSelf.value) return motivation.summary.value
  const days = unpackStudyDays(p?.studyDays, p?.studyDaysEnd)
  return days ? summarizeTier(days) : null
})
const summary = computed(() => {
  if (devTier.value) return null
  if (ownView.value) return motivationShown.value !== 'nobody' ? motivation.summary.value : null
  return visitorSummary.value
})
const forcedTier = computed(() => (devTier.value && devTier.value !== 'none' ? devTier.value : null))
const cardTier = computed(() => forcedTier.value ?? summary.value?.tier ?? null)
const shownTier = computed(() => {
  if (devTier.value) return forcedTier.value
  if (ownView.value) return motivation.ownTier.value
  if (tierShownTo.value !== 'everyone') return null
  if (isSelf.value) return motivation.publicTier.value
  const p = publicPrefs.value
  return visitorSummary.value?.tier ?? publishedTier(p?.studyTier, p?.studyTierAt)
})
const tierStyle = computed(() => (devTier.value ? 'theme' : (publicPrefs.value?.tierStyle ?? DEFAULT_PREFS.tierStyle)))
const themeTier = computed(() => (shownTier.value && tierStyle.value !== 'badge' ? shownTier.value : null))
const badgeTier = computed(() => shownTier.value)
const decorated = computed(() => Boolean(themeTier.value || leadRole.value))
const haloTier = computed(() => themeTier.value && tierRank(themeTier.value) >= tierRank('champion'))

const backdrop = usePageBackdrop()
watchEffect(() => {
  backdrop.value = decorated.value && !loading.value ? { tier: themeTier.value, role: leadRole.value } : null
})
onBeforeUnmount(() => {
  backdrop.value = null
})

useHead(() => ({
  title: profile.value ? `${profile.value.displayName || profile.value.handle} · OpenDeck` : 'Profile · OpenDeck',
}))

async function load() {
  loading.value = true
  await authReady
  notFound.value = false
  try {
    const p = await getBskyProfile(handle.value)
    if (!p) return void (notFound.value = true)
    profile.value = p
    did.value = p.did

    const [prefsRec, following, followers] = await Promise.all([
      readAirspace(p.did)
        .profile.get()
        .catch(() => null),
      social.listFollowingOf(p.did).catch(() => [] as string[]),
      social.countFollowersOf(p.did).catch(() => null),
    ])
    const ownPrefs = authUser.value?.did === p.did ? useProfile().prefs.value : null
    viewerPrefs.value = (prefsRec?.value as OpenDeckPrefs) ?? ownPrefs
    followingCount.value = following.length
    followersCount.value = followers

    if (authUser.value && authUser.value.did !== p.did) {
      const mine = await social.listMyFollows()
      followRkey.value = mine.get(p.did) ?? null
    }

    if (isSelf.value) {
      userDecks.value = (await decks.listMyDecks()).filter((d) => d.visibility === 'public')
    } else if (decksPublic.value) {
      userDecks.value = await decks.listDecksOf(p.did)
    }
  } catch (err) {
    console.error(err)
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(loadOwnStats, (shown) => {
  if (shown && !stats.value) void loadStats()
})
watch(handle, load)

const bio = computed(() => viewerPrefs.value?.bio || profile.value?.description)

const busy = ref(false)
async function toggleFollow() {
  if (!did.value || busy.value) return
  busy.value = true
  try {
    if (followRkey.value) {
      await social.unfollow(followRkey.value)
      followRkey.value = null
      if (followersCount.value) followersCount.value--
    } else {
      followRkey.value = await social.follow(did.value)
      if (followersCount.value !== null) followersCount.value++
    }
  } catch (err) {
    toast.add({ title: t('profile.updateFollowError'), description: String(err), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="relative isolate space-y-8" :class="decorated ? 'tier-themed' : ''">
    <component
      :is="DevThemePicker"
      v-if="DevThemePicker && profile"
      v-model:tier="devTier"
      v-model:roles="devRoles"
      v-model:visitor="devVisitor"
      :is-self="isSelf"
    />
    <div v-if="loading" class="space-y-4">
      <div class="flex items-center gap-4">
        <USkeleton class="size-16 shrink-0 rounded-full" />
        <div class="space-y-2">
          <USkeleton class="h-5 w-40" />
          <USkeleton class="h-4 w-24" />
        </div>
      </div>
    </div>

    <UAlert
      v-else-if="notFound"
      icon="i-lucide-user-x"
      :title="$t('profile.notFound')"
      :description="$t('profile.notFoundBody')"
      color="neutral"
      variant="subtle"
    />

    <template v-else-if="profile">
      <header
        :class="
          decorated
            ? [
                'border-default surface overflow-hidden rounded-2xl border',
                themeTier ? `tier-${themeTier}` : '',
                leadRole ? `role-${leadRole}` : '',
              ]
            : ''
        "
      >
        <div
          v-if="decorated"
          class="relative"
          :class="[themeTier ? 'tier-sheen' : 'role-banner', leadRole ? 'h-24 sm:h-28' : 'h-16 sm:h-20']"
          aria-hidden="true"
        >
          <RoleOrnament v-if="leadRole" :role="leadRole" :seed="did ?? undefined" />
        </div>
        <div class="space-y-4" :class="decorated ? 'p-4 sm:p-6' : ''">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div class="flex min-w-0 flex-1 flex-col gap-3">
              <div class="flex min-w-0 items-center gap-4">
                <span class="shrink-0" :class="haloTier ? 'tier-halo' : ''">
                  <UAvatar :src="profile.avatar" :alt="profile.handle" size="xl" :class="themeTier ? 'tier-ring' : ''" />
                </span>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 class="text-xl font-bold tracking-tight wrap-break-word">
                      {{ profile.displayName || profile.handle }}
                    </h1>
                    <TierBadge v-if="badgeTier" :tier="badgeTier" size="sm" />
                  </div>
                  <p class="text-muted truncate text-sm">@{{ profile.handle }}</p>
                </div>
              </div>
              <ul v-if="shownCredits.length" class="flex flex-wrap gap-1.5" :aria-label="$t('roles.title')">
                <li v-for="credit in shownCredits" :key="credit.role" class="max-w-full">
                  <RoleBadge :credit="credit" />
                </li>
              </ul>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <template v-if="isSelf">
                <UButton
                  to="/settings"
                  icon="i-lucide-settings"
                  color="neutral"
                  variant="subtle"
                  :label="$t('profile.settings')"
                />
                <UButton
                  icon="i-lucide-log-out"
                  color="neutral"
                  variant="ghost"
                  :aria-label="$t('profile.signOut')"
                  @click="signOut"
                />
              </template>
              <UButton
                v-else-if="isLoggedIn"
                :label="isFollowing ? $t('profile.following') : $t('profile.follow')"
                :icon="isFollowing ? 'i-lucide-check' : 'i-lucide-plus'"
                :color="isFollowing ? 'neutral' : 'primary'"
                :variant="isFollowing ? 'subtle' : 'solid'"
                :loading="busy"
                @click="toggleFollow"
              />
            </div>
          </div>

          <p v-if="bio" class="text-sm wrap-break-word text-neutral-600 dark:text-neutral-300">{{ bio }}</p>

          <div class="flex flex-wrap gap-4 text-sm">
            <NuxtLink
              v-if="followersCount !== null"
              :to="`${profilePath(handle)}/followers`"
              class="inline-flex items-center gap-1"
            >
              <strong>{{ followersCount }}</strong>
              <span class="text-muted">{{ $t('profile.followersCount', followersCount) }}</span>
            </NuxtLink>
            <NuxtLink
              v-if="showFollowing"
              :to="`${profilePath(handle)}/following`"
              class="inline-flex items-center gap-1"
            >
              <strong>{{ followingCount }}</strong>
              <span class="text-muted">{{ $t('profile.followingCount', followingCount) }}</span>
            </NuxtLink>
            <a v-if="showDecks" href="#decks" class="inline-flex items-center gap-1">
              <strong>{{ userDecks.length }}</strong>
              <span class="text-muted">{{ $t('profile.decksCount', userDecks.length) }}</span>
            </a>
          </div>
        </div>
      </header>

      <section v-if="shownStats" class="space-y-3">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold">{{ $t('profile.studyProgress') }}</h2>
          <UBadge
            v-if="ownView && statsShownTo === 'me'"
            :label="$t('profile.onlyYou')"
            icon="i-lucide-eye-off"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
        <ProgressStats :stats="shownStats" :shared="!ownView" />
      </section>

      <section v-if="cardTier" id="tier" class="scroll-mt-20">
        <h2 class="sr-only">{{ $t('tier.title') }}</h2>
        <TierCard :tier="cardTier" :summary="summary" :own="ownView">
          <template v-if="ownView && motivationShown === 'me'" #badge>
            <UBadge :label="$t('profile.onlyYou')" icon="i-lucide-eye-off" color="neutral" variant="subtle" size="sm" />
          </template>
        </TierCard>
      </section>

      <section v-if="showDecks" id="decks" class="scroll-mt-20 space-y-3">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold">{{ $t('profile.decks') }}</h2>
          <UBadge
            v-if="ownView && !decksPublic"
            :label="$t('profile.onlyYou')"
            icon="i-lucide-eye-off"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
        <p v-if="userDecks.length === 0" class="text-muted text-sm">{{ $t('profile.noPublicDecks') }}</p>
        <div v-else class="grid gap-4 sm:grid-cols-2">
          <DeckCard v-for="deck in userDecks" :key="deck.uri" :deck="deck" :to="deckPath(handle, deck.rkey)" />
        </div>
      </section>

      <UAlert
        v-else
        icon="i-lucide-eye-off"
        color="neutral"
        variant="subtle"
        :title="$t('profile.privateTitle')"
        :description="$t('profile.privateBody')"
        class="surface"
      />
    </template>
  </div>
</template>
