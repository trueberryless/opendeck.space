<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DeckView } from '~/composables/useDecks'
import { getBskyProfiles, type BskyProfile } from '~/utils/bsky'

const { t } = useI18n()
useHead(() => ({ title: `${t('discover.title')} · OpenDeck` }))

const isLoggedIn = useIsLoggedIn()
const decks = useDecks()
const social = useSocial()
const packs = useStarterPacks().list()

interface FeedItem {
  deck: DeckView
  author?: BskyProfile
}

const feed = ref<FeedItem[]>([])
const loading = ref(false)
const loaded = ref(false)

onMounted(async () => {
  if (!isLoggedIn.value) return
  loading.value = true
  try {
    const follows = await social.listMyFollows()
    const dids = [...follows.keys()]
    if (dids.length === 0) {
      loaded.value = true
      return
    }
    const profiles = await getBskyProfiles(dids)
    const byDid = new Map(profiles.map((p) => [p.did, p]))

    const lists = await Promise.all(dids.map((did) => decks.listDecksOf(did).catch(() => [] as DeckView[])))
    feed.value = lists
      .flat()
      .map((deck) => ({ deck, author: byDid.get(deck.author) }))
      .sort((a, b) => (b.deck.value.createdAt || '').localeCompare(a.deck.value.createdAt || ''))
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
    loaded.value = true
  }
})

function authorActor(item: FeedItem): string {
  return item.author?.handle || item.deck.author
}
</script>

<template>
  <div class="space-y-10">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('discover.title') }}</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('discover.subtitle') }}</p>
    </header>

    <section class="space-y-3">
      <div>
        <h2 class="font-medium">{{ $t('discover.startHeading') }}</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('discover.startSubtitle') }}</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="pack in packs"
          :key="pack.id"
          :to="`/starter/${pack.id}`"
          class="border-default hover::border-(--accent) block rounded-lg border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        >
          <div class="flex items-center gap-1.5">
            <h3 class="line-clamp-1 font-semibold">{{ $t(`packs.${pack.id}.name`) }}</h3>
            <UIcon
              v-if="pack.verified"
              name="i-lucide-badge-check"
              class="text-accent size-4 shrink-0"
              :aria-label="$t('starter.verified')"
            />
          </div>
          <p class="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
            {{ $t(`packs.${pack.id}.description`) }}
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <span class="inline-flex items-center gap-1">
              <UIcon name="i-lucide-layers" class="size-3.5" />
              {{ $t('starter.entriesCount', { count: pack.entries.length }) }}
            </span>
            <span class="inline-flex items-center gap-1">
              <UIcon name="i-lucide-languages" class="size-3.5" />
              {{ $t('starter.languagesCount', { count: pack.languages.length }) }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="font-medium">{{ $t('discover.findHeading') }}</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('discover.subtitle') }}</p>
      </div>
      <ActorSearch />
    </section>

    <section v-if="isLoggedIn" class="space-y-3">
      <h2 class="font-medium">{{ $t('discover.fromFollows') }}</h2>

      <div v-if="loading" class="grid gap-4 sm:grid-cols-2">
        <USkeleton v-for="i in 2" :key="i" class="h-28 w-full" />
      </div>

      <div
        v-else-if="loaded && feed.length === 0"
        class="border-default rounded-lg border border-dashed p-8 text-center text-sm text-neutral-500"
      >
        <p>{{ $t('discover.nothingHere') }}</p>
        <p class="mt-1">{{ $t('discover.followPrompt') }}</p>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2">
        <div v-for="item in feed" :key="item.deck.uri" class="space-y-1.5">
          <DeckCard :deck="item.deck" :to="deckPath(authorActor(item), item.deck.rkey)" />
          <NuxtLink
            v-if="item.author"
            :to="profilePath(item.author.handle)"
            class="hover:text-accent flex items-center gap-1.5 px-1 text-xs text-neutral-500"
          >
            <UAvatar :src="item.author.avatar" :alt="item.author.handle" size="3xs" />
            {{ item.author.displayName || item.author.handle }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <section v-else class="border-default rounded-lg border border-dashed p-8 text-center text-sm text-neutral-500">
      <p>{{ $t('discover.signInPrompt') }}</p>
      <UButton to="/login" class="mt-3" :label="$t('common.signIn')" icon="i-lucide-log-in" size="sm" />
    </section>
  </div>
</template>
