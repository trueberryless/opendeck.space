<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <!-- Desktop footer. On mobile, Terms/Privacy live under Settings instead. -->
  <footer class="border-default mt-16 hidden border-t md:block">
    <div
      class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400"
    >
      <p>© {{ year }} OpenDeck</p>
      <nav class="flex items-center gap-4" aria-label="Legal">
        <NuxtLink to="/terms" class="hover:text-accent">Terms</NuxtLink>
        <NuxtLink to="/privacy" class="hover:text-accent">Privacy</NuxtLink>
        <a href="https://atproto.com" target="_blank" rel="noopener noreferrer" class="hover:text-accent">
          Built on ATproto
        </a>
      </nav>
    </div>
  </footer>
</template>
