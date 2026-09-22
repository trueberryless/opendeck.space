<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

useHead(() => ({ title: `${t('starter.title')} · OpenDeck` }))

const { list } = useStarterPacks()
const packs = list()

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return packs
  return packs.filter((p) => t(`packs.${p.id}.name`).toLowerCase().includes(q))
})
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('starter.title') }}</h1>
      <p class="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">{{ $t('starter.intro') }}</p>
    </header>

    <UInput
      v-model="query"
      icon="i-lucide-search"
      :placeholder="$t('starter.searchPlaceholder')"
      size="lg"
      class="w-full max-w-sm"
      :ui="{ base: 'w-full' }"
    />

    <div
      v-if="filtered.length === 0"
      class="border-default rounded-lg border border-dashed p-8 text-center text-sm text-neutral-500"
    >
      {{ $t('starter.noMatch', { query }) }}
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="pack in filtered"
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

    <p class="text-xs text-neutral-400">
      {{ $t('starter.contributePre') }}
      <NuxtLink
        to="https://github.com/trueberryless/opendeck.space"
        class="hover:text-accent underline"
        target="_blank"
      >
        {{ $t('starter.contribute') }}
      </NuxtLink>
      {{ $t('starter.contributePost') }}
    </p>
  </div>
</template>
