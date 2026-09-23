<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-default mt-16 hidden border-t md:block">
    <div
      class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400"
    >
      <p>{{ $t('footer.copyright', { year }) }}</p>
      <nav class="flex items-center gap-4" :aria-label="$t('footer.legal')">
        <NuxtLink to="/terms" class="hover:text-accent">{{ $t('footer.terms') }}</NuxtLink>
        <NuxtLink to="/privacy" class="hover:text-accent">{{ $t('footer.privacy') }}</NuxtLink>
        <a href="https://atproto.com" target="_blank" rel="noopener noreferrer" class="hover:text-accent">
          {{ $t('footer.builtOn') }}
        </a>
      </nav>
    </div>
  </footer>
</template>
