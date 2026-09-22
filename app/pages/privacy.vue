<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const user = useAuthUser()
const { t } = useI18n()
useHead(() => ({ title: `${t('privacy.title')} | OpenDeck` }))

const recordsUrl = computed(() => (user.value ? `https://pdsls.dev/at/${user.value.did}` : 'https://pdsls.dev'))
</script>

<template>
  <div class="max-w-2xl py-8">
    <h1 class="mb-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">{{ $t('privacy.title') }}</h1>
    <p class="mb-12 text-sm text-neutral-500 dark:text-neutral-400">{{ $t('privacy.updated') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('privacy.s1Title') }}
    </h2>
    <i18n-t keypath="privacy.s1Body" tag="p" class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
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
      {{ $t('privacy.s2Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('privacy.s2Body') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('privacy.s3Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('privacy.s3Body') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('privacy.s4Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('privacy.s4Body') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('privacy.s5Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('privacy.s5Body') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('privacy.s6Title') }}
    </h2>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('privacy.s6Body') }}</p>
  </div>
</template>
