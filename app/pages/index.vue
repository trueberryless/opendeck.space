<script setup lang="ts">
import { authReady } from '~/composables/useAirspace'
import type { DeckView } from '~/composables/useDecks'

useHead({ title: 'OpenDeck · Learn languages you own' })

const isLoggedIn = useIsLoggedIn()
const authUser = useAuthUser()
const me = useMe()

const selfActor = computed(() => authUser.value?.handle || authUser.value?.did || '')

const decks = ref<DeckView[]>([])
const pending = ref(true)

async function loadDecks(did: string | undefined) {
  if (!did) {
    decks.value = []
    pending.value = false
    return
  }
  pending.value = true
  try {
    decks.value = await useDecks().listMyDecks()
  } catch (err) {
    console.error(err)
  } finally {
    pending.value = false
  }
}

onMounted(async () => {
  await authReady
  watch(() => authUser.value?.did, loadDecks, { immediate: true })
})

const FEATURES = [
  { icon: 'i-lucide-database', title: 'home.features.ownTitle', text: 'home.features.ownText' },
  { icon: 'i-lucide-brain', title: 'home.features.srsTitle', text: 'home.features.srsText' },
  { icon: 'i-lucide-download', title: 'home.features.bringTitle', text: 'home.features.bringText' },
  { icon: 'i-lucide-wifi-off', title: 'home.features.offlineTitle', text: 'home.features.offlineText' },
]
</script>

<template>
  <div v-if="isLoggedIn" class="space-y-8">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <h1 class="truncate text-2xl font-bold tracking-tight">
          {{ me?.displayName ? $t('home.welcomeBack', { name: me.displayName }) : $t('home.yourDecks') }}
        </h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ !pending && decks.length === 0 ? $t('home.firstJourney') : $t('home.pickUp') }}
        </p>
      </div>
      <div v-if="decks.length > 0" class="flex flex-wrap gap-2">
        <UButton
          to="/discover"
          :label="$t('home.starterDecks')"
          icon="i-lucide-sparkles"
          color="neutral"
          variant="subtle"
        />
        <UButton to="/import" :label="$t('home.import')" icon="i-lucide-download" color="neutral" variant="subtle" />
        <UButton to="/decks/new" :label="$t('home.newDeck')" icon="i-lucide-plus" />
      </div>
    </header>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="i in 3" :key="i" class="h-28 w-full" />
    </div>

    <div v-else-if="decks.length === 0" class="border-default rounded-lg border border-dashed p-10 text-center">
      <UIcon name="i-lucide-layers" class="mx-auto size-8 text-neutral-400" />
      <p class="mt-3 font-medium">{{ $t('home.emptyTitle') }}</p>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{{ $t('home.emptyBody') }}</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <UButton to="/discover" :label="$t('home.starterDecks')" icon="i-lucide-sparkles" />
        <UButton to="/decks/new" :label="$t('home.newDeck')" icon="i-lucide-plus" color="neutral" variant="subtle" />
        <UButton to="/import" :label="$t('home.import')" icon="i-lucide-download" color="neutral" variant="subtle" />
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DeckCard v-for="deck in decks" :key="deck.uri" :deck="deck" :to="deckPath(selfActor, deck.rkey)" />
    </div>
  </div>
  <div v-else class="space-y-16">
    <section class="grid items-center gap-10 py-8 lg:grid-cols-2 lg:py-16">
      <div class="order-2 text-center lg:order-1 lg:text-start">
        <h1 class="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          {{ $t('home.landingTitle') }}
        </h1>
        <p class="mx-auto mt-4 max-w-xl text-pretty text-neutral-500 lg:mx-0 dark:text-neutral-400">
          {{ $t('home.landingSubtitle') }}
        </p>
        <div class="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
          <UButton to="/login" :label="$t('home.getStarted')" icon="i-lucide-log-in" size="lg" />
          <UButton
            to="/discover"
            :label="$t('home.starterDecks')"
            icon="i-lucide-sparkles"
            size="lg"
            color="neutral"
            variant="subtle"
          />
        </div>
      </div>
      <div class="order-1 flex justify-center lg:order-2 lg:justify-end">
        <Logo accent-front class="h-auto w-40 text-neutral-900 sm:w-56 lg:w-72 dark:text-neutral-100" />
      </div>
    </section>
    <section class="mx-auto max-w-xl space-y-3">
      <div class="text-center">
        <h2 class="text-lg font-semibold">{{ $t('home.findTitle') }}</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('home.findSubtitle') }}</p>
      </div>
      <ActorSearch />
    </section>
    <section class="grid gap-4 sm:grid-cols-2">
      <div v-for="f in FEATURES" :key="f.title" class="border-default rounded-xl border p-5">
        <UIcon :name="f.icon" class="text-accent size-6" />
        <h3 class="mt-3 font-semibold">{{ $t(f.title) }}</h3>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{{ $t(f.text) }}</p>
      </div>
    </section>
    <section class="border-default rounded-xl border p-8 text-center">
      <h2 class="text-xl font-semibold">{{ $t('home.readyTitle') }}</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">{{ $t('home.readyBody') }}</p>
      <UButton to="/login" :label="$t('home.getStarted')" icon="i-lucide-log-in" size="lg" class="mt-5" />
    </section>
  </div>
</template>
