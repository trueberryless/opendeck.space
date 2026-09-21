<script setup lang="ts">
const user = useAuthUser()
useHead({ title: 'Terms of Service | OpenDeck' })
</script>

<template>
  <div class="max-w-2xl py-8">
    <h1 class="mb-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Terms of Service</h1>
    <p class="mb-12 text-sm text-neutral-500 dark:text-neutral-400">Last updated September 2026</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      1. What OpenDeck is
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      OpenDeck is an open flashcard application built on the AT Protocol. It reads from and writes to your Personal Data
      Server. OpenDeck does not operate its own account system and does not store your flashcards, study progress, or
      profile on its own servers.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      2. Your account and data
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      You sign in with an existing ATproto identity. All content you create, including decks, cards, study progress,
      likes and follows, is stored as records in your own repository under the space.opendeck lexicons. You may delete
      or export this data at any time using any ATproto compatible tool. You can view your raw records on
      <a
        :href="user ? `https://pdsls.dev/at/${user.did}` : 'https://pdsls.dev'"
        target="_blank"
        rel="noopener noreferrer"
        class="text-[var(--accent)] underline underline-offset-4 hover:opacity-80"
        >pdsls.dev</a
      >.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      3. Public by nature
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      Most data on ATproto is public by default. Unless a record is stored in a permissioned Space, assume anything you
      publish can be read by others. OpenDeck lets you choose what appears on your profile, but this is a display
      preference and not a confidentiality guarantee.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">4. Acceptable use</h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      Do not use OpenDeck to publish unlawful content or to infringe the rights of others. Because content lives in your
      repository, you are responsible for it.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">5. No warranty</h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      OpenDeck is provided as is without warranty of any kind. Spaced repetition scheduling is a study aid and not a
      guarantee of results.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">6. Changes</h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      These terms may change as the project evolves. Continued use means you accept the current version.
    </p>
  </div>
</template>
