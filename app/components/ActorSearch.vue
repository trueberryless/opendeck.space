<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-3">
    <UInput
      v-model="query"
      :placeholder="$t('actorSearch.placeholder')"
      icon="i-lucide-search"
      size="lg"
      class="w-full"
      :loading="searching"
      autocapitalize="none"
      autocorrect="off"
    />

    <ProfileList v-if="results.length" :profiles="results" />

    <p v-else-if="searched && !searching" class="text-sm text-neutral-500">{{ $t('actorSearch.noPeople') }}</p>
  </div>
</template>
