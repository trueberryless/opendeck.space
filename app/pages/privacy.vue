<script setup lang="ts">
const user = useAuthUser()
useHead({ title: 'Privacy Policy | OpenDeck' })
</script>

<template>
  <div class="max-w-2xl py-8">
    <h1 class="mb-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Privacy Policy</h1>
    <p class="mb-12 text-sm text-neutral-500 dark:text-neutral-400">Last updated September 2026</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      Where your data lives
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      OpenDeck stores everything in your own ATproto repository. We do not run a database of your flashcards or progress
      and we do not sell or share your data since we never hold it. You can explore your public records on
      <a
        :href="user ? `https://pdsls.dev/at/${user.did}` : 'https://pdsls.dev'"
        target="_blank"
        rel="noopener noreferrer"
        class="text-(--accent) underline underline-offset-4 hover:opacity-80"
        >pdsls.dev</a
      >.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">Authentication</h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      Sign in uses ATproto OAuth. Tokens are handled entirely in your browser and stored locally. OpenDeck never sees
      your password because you authenticate directly with your Personal Data Server.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">What we read</h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      To show your name and avatar, OpenDeck reads your public Bluesky profile. Account search uses the public AppView
      network. These are public ATproto endpoints.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">Local storage</h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      For offline support and speed, OpenDeck caches decks, cards and progress in your browser. It also remembers small
      preferences like your theme in local storage. This data stays on your device and can be cleared at any time.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">Notifications</h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      Study reminders are scheduled locally by your browser and only fire if you grant notification permission. No push
      server is involved and no reminder data leaves your device.
    </p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">Analytics</h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      OpenDeck ships without third party tracking or advertising.
    </p>
  </div>
</template>
