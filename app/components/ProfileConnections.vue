<script setup lang="ts">
import type { OpenDeckPrefs } from '~/composables/useProfile'
import { useI18n } from 'vue-i18n'
import { getBskyProfile, getBskyProfiles, type BskyProfile } from '~/utils/bsky'

const props = defineProps<{ kind: 'followers' | 'following' }>()

const PAGE_SIZE = 50

const { t } = useI18n()
const route = useRoute()
const authUser = useAuthUser()
const social = useSocial()

const handle = computed(() => route.params.handle as string)

const profile = ref<BskyProfile | null>(null)
const people = ref<BskyProfile[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const notFound = ref(false)
const hidden = ref(false)
const failed = ref(false)
const hasMore = ref(false)
const onlyYou = ref(false)

let followingDids: string[] = []
let followingOffset = 0
let followersCursor: string | null = null

const title = computed(() => (props.kind === 'followers' ? t('profile.followersTitle') : t('profile.followingTitle')))
const name = computed(() => profile.value?.displayName || profile.value?.handle || handle.value)

useHead(() => ({ title: `${title.value} · ${name.value} · OpenDeck` }))

async function resolveProfiles(dids: string[]): Promise<BskyProfile[]> {
  const byDid = new Map((await getBskyProfiles(dids)).map((p) => [p.did, p]))
  return dids.flatMap((did) => byDid.get(did) ?? [])
}

async function nextPage(): Promise<BskyProfile[]> {
  if (props.kind === 'following') {
    const slice = followingDids.slice(followingOffset, followingOffset + PAGE_SIZE)
    followingOffset += slice.length
    hasMore.value = followingOffset < followingDids.length
    return resolveProfiles(slice)
  }
  const page = await social.listFollowersOf(profile.value!.did, followersCursor, PAGE_SIZE)
  followersCursor = page.cursor
  hasMore.value = Boolean(page.cursor) && page.dids.length > 0
  return resolveProfiles(page.dids)
}

async function load() {
  loading.value = true
  notFound.value = false
  hidden.value = false
  failed.value = false
  onlyYou.value = false
  people.value = []
  followingDids = []
  followingOffset = 0
  followersCursor = null
  if (profile.value && profile.value.handle !== handle.value && profile.value.did !== handle.value) profile.value = null
  try {
    const p = await getBskyProfile(handle.value)
    if (!p) return void (notFound.value = true)
    profile.value = p

    if (props.kind === 'following') {
      const isSelf = authUser.value?.did === p.did
      const prefs = await readAirspace(p.did)
        .profile.get()
        .catch(() => null)
      const followsPublic = Boolean((prefs?.value as OpenDeckPrefs | undefined)?.showFollowsOnProfile)
      if (!isSelf && !followsPublic) return void (hidden.value = true)
      onlyYou.value = isSelf && !followsPublic
      followingDids = await social.listFollowingOf(p.did)
    }

    people.value = await nextPage()
  } catch (err) {
    console.error(err)
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    people.value = [...people.value, ...(await nextPage())]
  } catch (err) {
    console.error(err)
    failed.value = true
  } finally {
    loadingMore.value = false
  }
}

onMounted(load)
watch([handle, () => props.kind], load)
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <div class="flex items-center gap-2">
      <UButton
        :to="profilePath(handle)"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="$t('common.back')"
      />
      <template v-if="profile">
        <UAvatar :src="profile.avatar" :alt="profile.handle" class="size-10 shrink-0" />
        <div class="min-w-0">
          <h1 class="truncate text-xl font-bold tracking-tight">{{ name }}</h1>
          <p class="truncate text-sm text-neutral-500">@{{ profile.handle }}</p>
        </div>
      </template>
      <template v-else-if="loading">
        <USkeleton class="size-10 shrink-0 rounded-full" />
        <div class="min-w-0">
          <div class="flex h-7 items-center"><USkeleton class="h-5 w-40" /></div>
          <div class="flex h-5 items-center"><USkeleton class="h-3.5 w-24" /></div>
        </div>
      </template>
      <h1 v-else class="truncate text-xl font-bold tracking-tight">{{ name }}</h1>
    </div>

    <nav class="flex gap-2">
      <UButton
        :to="`${profilePath(handle)}/followers`"
        :label="$t('profile.followersTitle')"
        :color="kind === 'followers' ? 'primary' : 'neutral'"
        :variant="kind === 'followers' ? 'solid' : 'subtle'"
      />
      <UButton
        :to="`${profilePath(handle)}/following`"
        :label="$t('profile.followingTitle')"
        :color="kind === 'following' ? 'primary' : 'neutral'"
        :variant="kind === 'following' ? 'solid' : 'subtle'"
      />
      <UBadge
        v-if="kind === 'following' && onlyYou && !loading"
        :label="$t('profile.onlyYou')"
        icon="i-lucide-eye-off"
        color="neutral"
        variant="subtle"
        size="sm"
        class="self-center"
      />
    </nav>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="flex items-center gap-3">
        <USkeleton class="size-8 shrink-0 rounded-full" />
        <div class="space-y-2">
          <USkeleton class="h-4 w-40" />
          <USkeleton class="h-3 w-24" />
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

    <UAlert
      v-else-if="hidden"
      icon="i-lucide-eye-off"
      :title="$t('profile.followsHiddenTitle')"
      :description="$t('profile.followsHiddenBody')"
      color="neutral"
      variant="subtle"
    />

    <template v-else>
      <UAlert
        v-if="failed"
        icon="i-lucide-triangle-alert"
        :title="$t('profile.connectionsError')"
        color="error"
        variant="subtle"
      />
      <ProfileList v-if="people.length" :profiles="people" />
      <p v-else-if="!failed" class="text-sm text-neutral-500">
        {{ kind === 'followers' ? $t('profile.noFollowers') : $t('profile.noFollowing') }}
      </p>
      <div v-if="hasMore" class="flex justify-center">
        <UButton
          :label="$t('profile.loadMore')"
          color="neutral"
          variant="subtle"
          :loading="loadingMore"
          @click="loadMore"
        />
      </div>
    </template>
  </div>
</template>
