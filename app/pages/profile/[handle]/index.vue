<script setup lang="ts">
import type { OpenDeckPrefs } from '~/utils/records'
import { authReady } from '~/composables/useAirspace'
import type { DeckView } from '~/composables/useDecks'
import { useI18n } from 'vue-i18n'
import { getBskyProfile, type BskyProfile } from '~/utils/bsky'
import { isTier, publishedTier, tierRank, type Tier } from '~/utils/tiers'
import { isRole, type Role } from '~~/shared/credits'
import { creditsFor, type Credit } from '~/utils/credits'

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
const decksPublic = computed(() => Boolean(viewerPrefs.value?.showDecksOnProfile))
const showDecks = computed(() => isSelf.value || decksPublic.value)
const followsPublic = computed(() => Boolean(viewerPrefs.value?.showFollowsOnProfile))
const showFollowing = computed(() => isSelf.value || followsPublic.value)
const progressPublic = computed(() => Boolean(viewerPrefs.value?.showProgressOnProfile))

const motivation = useMotivation()
const previewTheme = ref(false)
const isDev = import.meta.dev
const DevThemePicker = import.meta.dev ? defineAsyncComponent(() => import('~/components/DevThemePicker.vue')) : null
const devTier = ref<Tier | null>(isDev && isTier(route.query.tier) ? route.query.tier : null)
const devRoles = ref<Role[]>(
  isDev
    ? String(route.query.roles ?? '')
        .split(',')
        .filter(isRole)
    : [],
)
const credits = computed(() => (did.value ? creditsFor(did.value) : []))
const shownCredits = computed<Credit[]>(() =>
  devRoles.value.length ? devRoles.value.map((role) => ({ role })) : credits.value,
)
const leadRole = computed(() => shownCredits.value[0]?.role ?? null)
const tier = computed(() => {
  if (devTier.value) return devTier.value
  if (isSelf.value) return motivation.enabled.value ? (motivation.summary.value?.tier ?? null) : null
  const p = viewerPrefs.value
  if (!p?.showTierOnProfile || p.motivationEnabled === false) return null
  return publishedTier(p.studyTier, p.studyTierAt)
})
const themeTier = computed(() =>
  tier.value && (devTier.value || !isSelf.value || motivation.showOnProfile.value || previewTheme.value)
    ? tier.value
    : null,
)
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
  previewTheme.value = false
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
    viewerPrefs.value = (prefsRec?.value as OpenDeckPrefs) ?? null
    followingCount.value = following.length
    followersCount.value = followers

    if (authUser.value && authUser.value.did !== p.did) {
      const mine = await social.listMyFollows()
      followRkey.value = mine.get(p.did) ?? null
    }

    if (isSelf.value) {
      userDecks.value = (await decks.listMyDecks()).filter((d) => d.visibility === 'public')
      loadStats()
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
    <component :is="DevThemePicker" v-if="DevThemePicker && profile" v-model:tier="devTier" v-model:roles="devRoles" />
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
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex min-w-0 flex-1 items-center gap-4">
              <span class="shrink-0" :class="haloTier ? 'tier-halo' : ''">
                <UAvatar :src="profile.avatar" :alt="profile.handle" size="xl" :class="themeTier ? 'tier-ring' : ''" />
              </span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 class="text-xl font-bold tracking-tight wrap-break-word">
                    {{ profile.displayName || profile.handle }}
                  </h1>
                  <TierBadge v-if="themeTier" :tier="themeTier" size="sm" />
                </div>
                <p class="text-muted truncate text-sm">@{{ profile.handle }}</p>
                <ul v-if="shownCredits.length" class="mt-2 flex flex-wrap gap-1.5" :aria-label="$t('roles.title')">
                  <li v-for="credit in shownCredits" :key="credit.role" class="max-w-full">
                    <RoleBadge :credit="credit" />
                  </li>
                </ul>
              </div>
            </div>
            <div class="flex shrink-0 gap-2">
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

      <section v-if="isSelf && stats" class="space-y-3">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold">{{ $t('profile.studyProgress') }}</h2>
          <UBadge
            v-if="!progressPublic"
            :label="$t('profile.onlyYou')"
            icon="i-lucide-eye-off"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
        <ProgressStats :stats="stats" />
      </section>

      <section v-if="isSelf && tier" id="tier" class="scroll-mt-20">
        <h2 class="sr-only">{{ $t('tier.title') }}</h2>
        <TierCard :tier="tier" :summary="devTier ? null : motivation.summary.value">
          <template v-if="!motivation.showOnProfile.value" #badge>
            <UBadge :label="$t('profile.onlyYou')" icon="i-lucide-eye-off" color="neutral" variant="subtle" size="sm" />
          </template>
          <template v-if="!motivation.showOnProfile.value" #actions>
            <UButton
              :label="previewTheme ? $t('tier.stopPreview') : $t('tier.previewTheme')"
              :icon="previewTheme ? 'i-lucide-eye-off' : 'i-lucide-palette'"
              :aria-pressed="previewTheme"
              color="neutral"
              variant="subtle"
              size="sm"
              class="shrink-0"
              @click="previewTheme = !previewTheme"
            />
          </template>
        </TierCard>
      </section>

      <section v-if="showDecks" id="decks" class="scroll-mt-20 space-y-3">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold">{{ $t('profile.decks') }}</h2>
          <UBadge
            v-if="isSelf && !decksPublic"
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
