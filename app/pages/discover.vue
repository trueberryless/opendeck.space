<script setup lang="ts">
import { authReady } from '~/composables/useAirspace'
import { useI18n } from 'vue-i18n'
import type { DeckView } from '~/composables/useDecks'
import { getBskyProfiles, type BskyProfile } from '~/utils/bsky'

const { t } = useI18n()
useHead(() => ({ title: `${t('discover.title')} · OpenDeck` }))

const isLoggedIn = useIsLoggedIn()
const decks = useDecks()
const social = useSocial()
const packs = useStarterPacks().list()

const category = ref<PackCategory | 'all'>('all')
const categories = PACK_CATEGORIES.filter((c) => packs.some((p) => p.category === c))
const categoryOptions = ['all', ...categories] as const
const packGroups = computed(() =>
  categories
    .filter((c) => category.value === 'all' || c === category.value)
    .map((c) => ({ category: c, packs: packs.filter((p) => p.category === c) })),
)

interface FeedItem {
  deck: DeckView
  author?: BskyProfile
}

const feed = ref<FeedItem[]>([])
const loading = ref(false)
const loaded = ref(false)

onMounted(async () => {
  await authReady
  if (!useAuthUser().value) return
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
      <p class="text-muted text-sm">{{ $t('discover.subtitle') }}</p>
    </header>

    <section class="space-y-3">
      <div>
        <h2 class="font-medium">{{ $t('discover.findHeading') }}</h2>
        <p class="text-muted text-sm">{{ $t('discover.subtitle') }}</p>
      </div>
      <ActorSearch />
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="font-medium">{{ $t('discover.startHeading') }}</h2>
        <p class="text-muted text-sm">{{ $t('discover.startSubtitle') }}</p>
      </div>
      <div
        v-if="categories.length > 1"
        class="flex flex-wrap gap-1"
        role="group"
        :aria-label="$t('discover.categoryFilter')"
      >
        <UButton
          v-for="c in categoryOptions"
          :key="c"
          :label="$t(`discover.categories.${c}`)"
          :aria-pressed="category === c"
          size="xs"
          :color="category === c ? 'primary' : 'neutral'"
          :variant="category === c ? 'soft' : 'ghost'"
          @click="category = c"
        />
      </div>
      <div v-for="group in packGroups" :key="group.category" class="space-y-2">
        <h3
          v-if="category === 'all' && categories.length > 1"
          class="text-muted text-xs font-medium tracking-wide uppercase"
        >
          {{ $t(`discover.categories.${group.category}`) }}
        </h3>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="pack in group.packs"
            :key="pack.id"
            :to="`/starter/${pack.id}`"
            class="border-default block rounded-lg border p-4 transition-colors hover:border-(--accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
          >
            <div class="flex items-center gap-1.5">
              <h4 class="line-clamp-1 font-semibold">{{ $t(`packs.${pack.id}.name`) }}</h4>
              <span v-if="isPackVerified(pack)" class="shrink-0" :title="$t('starter.verified')">
                <UIcon name="i-lucide-badge-check" class="text-accent size-4" aria-hidden="true" />
                <span class="sr-only">{{ $t('starter.verified') }}</span>
              </span>
            </div>
            <p class="text-muted mt-1 line-clamp-2 text-sm">
              {{ $t(`packs.${pack.id}.description`) }}
            </p>
            <div class="text-muted mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-layers" class="size-3.5" />
                {{ $t('starter.entriesCount', { count: pack.entries.length }, pack.entries.length) }}
              </span>
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-languages" class="size-3.5" />
                {{ $t('starter.languagesCount', { count: pack.languages.length }, pack.languages.length) }}
              </span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <section v-if="isLoggedIn" class="space-y-3">
      <h2 class="font-medium">{{ $t('discover.fromFollows') }}</h2>

      <div v-if="loading" class="grid gap-4 sm:grid-cols-2">
        <USkeleton v-for="i in 2" :key="i" class="h-28 w-full" />
      </div>

      <div
        v-else-if="loaded && feed.length === 0"
        class="border-default text-muted rounded-lg border border-dashed p-8 text-center text-sm"
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
            class="hover:text-accent text-muted flex items-center gap-1.5 px-1 text-xs"
          >
            <UAvatar :src="item.author.avatar" :alt="item.author.handle" size="3xs" />
            {{ item.author.displayName || item.author.handle }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <section v-else class="border-default text-muted rounded-lg border border-dashed p-8 text-center text-sm">
      <p>{{ $t('discover.signInPrompt') }}</p>
      <UButton to="/login" class="mt-3" :label="$t('common.signIn')" icon="i-lucide-log-in" size="sm" />
    </section>
  </div>
</template>
