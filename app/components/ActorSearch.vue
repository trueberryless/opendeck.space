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
      placeholder="Search people by handle or name…"
      icon="i-lucide-search"
      size="lg"
      class="w-full"
      :loading="searching"
      autocapitalize="none"
      autocorrect="off"
    />

    <ul v-if="results.length" class="divide-default border-default divide-y overflow-hidden rounded-lg border">
      <li v-for="actor in results" :key="actor.did">
        <NuxtLink :to="profilePath(actor.handle)" class="hover:bg-muted flex items-center gap-3 p-3 transition-colors">
          <UAvatar :src="actor.avatar" :alt="actor.handle" size="sm" />
          <div class="min-w-0">
            <p class="truncate font-medium">{{ actor.displayName || actor.handle }}</p>
            <p class="truncate text-sm text-neutral-500">@{{ actor.handle }}</p>
          </div>
          <UIcon name="i-lucide-chevron-right" class="ms-auto size-4 text-neutral-400" />
        </NuxtLink>
      </li>
    </ul>

    <p v-else-if="searched && !searching" class="text-sm text-neutral-500">No people found.</p>
  </div>
</template>
