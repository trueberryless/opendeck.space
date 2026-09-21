<script setup lang="ts">
import type { DeckView } from '~/composables/useDecks'
import type { OpenDeckPrefs } from '~/composables/useProfile'
import { getBskyProfile, type BskyProfile } from '~/utils/bsky'

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
const userDecks = ref<DeckView[]>([])
const followRkey = ref<string | null>(null)
const loading = ref(true)
const notFound = ref(false)

const isSelf = computed(() => Boolean(did.value && authUser.value?.did === did.value))
const isFollowing = computed(() => followRkey.value !== null)
const decksPublic = computed(() => Boolean(viewerPrefs.value?.showDecksOnProfile))
const showDecks = computed(() => isSelf.value || decksPublic.value)
const progressPublic = computed(() => Boolean(viewerPrefs.value?.showProgressOnProfile))

useHead(() => ({
  title: profile.value ? `${profile.value.displayName || profile.value.handle} · OpenDeck` : 'Profile · OpenDeck',
}))

async function load() {
  loading.value = true
  notFound.value = false
  try {
    const p = await getBskyProfile(handle.value)
    if (!p) return void (notFound.value = true)
    profile.value = p
    did.value = p.did

    const [prefsRec, following] = await Promise.all([
      readAirspace(p.did)
        .profile.get()
        .catch(() => null),
      social.listFollowingOf(p.did).catch(() => [] as string[]),
    ])
    viewerPrefs.value = (prefsRec?.value as OpenDeckPrefs) ?? null
    followingCount.value = following.length

    if (isLoggedIn.value && authUser.value?.did !== p.did) {
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
    } else {
      followRkey.value = await social.follow(did.value)
    }
  } catch (err) {
    toast.add({ title: 'Could not update follow', description: String(err), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
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
      title="Profile not found"
      description="No ATproto account matches this handle."
      color="neutral"
      variant="subtle"
    />

    <template v-else-if="profile">
      <!-- Header -->
      <header class="space-y-4">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-4">
            <UAvatar :src="profile.avatar" :alt="profile.handle" size="xl" class="shrink-0" />
            <div class="min-w-0">
              <h1 class="text-xl font-bold tracking-tight wrap-break-word">
                {{ profile.displayName || profile.handle }}
              </h1>
              <p class="truncate text-sm text-neutral-500">@{{ profile.handle }}</p>
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            <template v-if="isSelf">
              <UButton to="/settings" icon="i-lucide-settings" color="neutral" variant="subtle" label="Settings" />
              <UButton icon="i-lucide-log-out" color="neutral" variant="ghost" aria-label="Sign out" @click="signOut" />
            </template>
            <UButton
              v-else-if="isLoggedIn"
              :label="isFollowing ? 'Following' : 'Follow'"
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
          <span
            ><strong>{{ followingCount }}</strong> <span class="text-neutral-500">following</span></span
          >
          <span v-if="showDecks"
            ><strong>{{ userDecks.length }}</strong> <span class="text-neutral-500">decks</span></span
          >
        </div>
      </header>

      <!-- Study progress (own profile) -->
      <section v-if="isSelf && stats" class="space-y-3">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold">Study progress</h2>
          <UBadge
            v-if="!progressPublic"
            label="Only you"
            icon="i-lucide-eye-off"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
        <ProgressStats :stats="stats" />
      </section>

      <!-- Decks -->
      <section v-if="showDecks" class="space-y-3">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold">Decks</h2>
          <UBadge
            v-if="isSelf && !decksPublic"
            label="Only you"
            icon="i-lucide-eye-off"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
        <p v-if="userDecks.length === 0" class="text-sm text-neutral-500">No public decks yet.</p>
        <div v-else class="grid gap-4 sm:grid-cols-2">
          <DeckCard v-for="deck in userDecks" :key="deck.uri" :deck="deck" :to="deckPath(handle, deck.rkey)" />
        </div>
      </section>

      <UAlert
        v-else
        icon="i-lucide-eye-off"
        color="neutral"
        variant="subtle"
        title="This profile is private"
        description="This person has not chosen to show their decks on OpenDeck."
      />
    </template>
  </div>
</template>
