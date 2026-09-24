<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { searchBskyActors, type BskyProfile } from '~/utils/bsky'

const query = ref('')
const results = ref<BskyProfile[]>([])
const searching = ref(false)
const searched = ref(false)

const run = useDebounceFn(async (q: string) => {
  if (!q.trim()) {
    results.value = []
    searched.value = false
    return
  }
  searching.value = true
  try {
    results.value = await searchBskyActors(q, 20)
    searched.value = true
  } finally {
    searching.value = false
  }
}, 300)

watch(query, (q) => run(q))

const input = useTemplateRef<{ inputRef?: HTMLInputElement }>('input')
const { t } = useI18n()
useShortcuts(
  'search',
  () => t('shortcuts.groups.general'),
  () => [{ keys: ['/'], label: t('shortcuts.search'), run: () => input.value?.inputRef?.focus() }],
)
</script>

<template>
  <div class="space-y-3">
    <UInput
      ref="input"
      v-model="query"
      type="search"
      :aria-label="$t('actorSearch.placeholder')"
      aria-keyshortcuts="/"
      :placeholder="$t('actorSearch.placeholder')"
      icon="i-lucide-search"
      size="lg"
      class="w-full"
      :loading="searching"
      autocapitalize="none"
      autocorrect="off"
    />

    <ProfileList v-if="results.length" :profiles="results" />

    <p v-else-if="searched && !searching" class="text-muted text-sm">{{ $t('actorSearch.noPeople') }}</p>

    <p class="sr-only" role="status">
      {{ searched && !searching ? $t('actorSearch.results', { count: results.length }, results.length) : '' }}
    </p>
  </div>
</template>
