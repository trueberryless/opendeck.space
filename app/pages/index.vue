<script setup lang="ts">
import type { DeckView } from '~/composables/useDecks'

useHead({ title: 'OpenDeck · Learn languages you own' })

const isLoggedIn = useIsLoggedIn()
const authUser = useAuthUser()
const me = useMe()

const selfActor = computed(() => authUser.value?.handle || authUser.value?.did || '')

const decks = ref<DeckView[]>([])
const pending = ref(true)

onMounted(async () => {
  if (!isLoggedIn.value) {
    pending.value = false
    return
  }
  try {
    decks.value = await useDecks().listMyDecks()
  } catch (err) {
    console.error(err)
  } finally {
    pending.value = false
  }
})

const FEATURES = [
  {
    icon: 'i-lucide-database',
    title: 'You own everything',
    text: 'Your decks, cards and progress live in your ATproto repository. Export them or move them whenever you like.',
  },
  {
    icon: 'i-lucide-brain',
    title: 'Spaced repetition',
    text: 'Repeat studying cards exactly when they start to slip your mind.',
  },
  {
    icon: 'i-lucide-download',
    title: 'Bring your decks',
    text: 'Import from Anki, Quizlet or a CSV file. Images and audio come along too.',
  },
  {
    icon: 'i-lucide-wifi-off',
    title: 'Study anywhere',
    text: 'Install OpenDeck as an app and keep studying offline. Your progress syncs when you reconnect.',
  },
]
</script>

<template>
  <!-- Signed-in dashboard -->
  <div v-if="isLoggedIn" class="space-y-8">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <h1 class="truncate text-2xl font-bold tracking-tight">
          {{ me?.displayName ? `Welcome back, ${me.displayName}` : 'Your decks' }}
        </h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">Pick up where you left off.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton to="/import" label="Import" icon="i-lucide-download" color="neutral" variant="subtle" />
        <UButton to="/decks/new" label="New deck" icon="i-lucide-plus" />
      </div>
    </header>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="i in 3" :key="i" class="h-28 w-full" />
    </div>

    <div v-else-if="decks.length === 0" class="border-default rounded-lg border border-dashed p-10 text-center">
      <UIcon name="i-lucide-layers" class="mx-auto size-8 text-neutral-400" />
      <p class="mt-3 font-medium">No decks yet</p>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Create your first deck, import one, or find one to copy on Discover.
      </p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <UButton to="/decks/new" label="New deck" icon="i-lucide-plus" />
        <UButton to="/import" label="Import" icon="i-lucide-download" color="neutral" variant="subtle" />
        <UButton to="/discover" label="Discover" icon="i-lucide-compass" color="neutral" variant="subtle" />
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DeckCard v-for="deck in decks" :key="deck.uri" :deck="deck" :to="deckPath(selfActor, deck.rkey)" />
    </div>
  </div>

  <!-- Signed-out landing -->
  <div v-else class="space-y-16">
    <section class="grid items-center gap-10 py-8 lg:grid-cols-2 lg:py-16">
      <div class="order-2 text-center lg:order-1 lg:text-left">
        <h1 class="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          Learn languages with flashcards you keep.
        </h1>
        <p class="mx-auto mt-4 max-w-xl text-pretty text-neutral-500 lg:mx-0 dark:text-neutral-400">
          OpenDeck saves your decks, cards and study progress in your own ATproto account. Sign in with Bluesky or any
          PDS and start learning in a couple of minutes.
        </p>
        <div class="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
          <UButton to="/login" label="Get started" icon="i-lucide-log-in" size="lg" />
          <UButton
            to="/discover"
            label="Browse people"
            icon="i-lucide-compass"
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

    <!-- Search CTA -->
    <section class="mx-auto max-w-xl space-y-3">
      <div class="text-center">
        <h2 class="text-lg font-semibold">Find people to learn from</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          Search any ATproto account to see the decks they share.
        </p>
      </div>
      <ActorSearch />
    </section>

    <!-- Features -->
    <section class="grid gap-4 sm:grid-cols-2">
      <div v-for="f in FEATURES" :key="f.title" class="border-default rounded-xl border p-5">
        <UIcon :name="f.icon" class="text-accent size-6" />
        <h3 class="mt-3 font-semibold">{{ f.title }}</h3>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{{ f.text }}</p>
      </div>
    </section>

    <!-- Closing CTA -->
    <section class="border-default rounded-xl border p-8 text-center">
      <h2 class="text-xl font-semibold">Ready to start?</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
        Your first deck takes a minute. Everything you create stays in your own repository.
      </p>
      <UButton to="/login" label="Get started" icon="i-lucide-log-in" size="lg" class="mt-5" />
    </section>
  </div>
</template>
