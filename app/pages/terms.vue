<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const user = useAuthUser()
const { t } = useI18n()
useHead(() => ({ title: `${t('terms.title')} | OpenDeck` }))

const recordsUrl = computed(() => (user.value ? `https://pdsls.dev/at/${user.value.did}` : 'https://pdsls.dev'))
</script>

<template>
  <div class="max-w-2xl py-8">
    <h1 class="mb-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">{{ $t('terms.title') }}</h1>
    <p class="mb-12 text-sm text-neutral-500 dark:text-neutral-400">{{ $t('terms.updated') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('terms.s1Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('terms.s1Body') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('terms.s2Title') }}
    </h2>
    <i18n-t keypath="terms.s2Body" tag="p" class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      <template #link>
        <a
          :href="recordsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-(--accent) underline underline-offset-4 hover:opacity-80"
          >pdsls.dev</a
        >
      </template>
    </i18n-t>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('terms.s3Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('terms.s3Body') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('terms.s4Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('terms.s4Body') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('terms.s5Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('terms.s5Body') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('terms.s6Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('terms.s6Body') }}</p>
  </div>
</template>
