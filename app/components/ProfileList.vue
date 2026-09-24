<script setup lang="ts">
import type { BskyProfile } from '~/utils/bsky'

defineProps<{ profiles: BskyProfile[] }>()
</script>

<template>
  <ul class="divide-default border-default divide-y overflow-hidden rounded-lg border">
    <li v-for="actor in profiles" :key="actor.did">
      <NuxtLink :to="profilePath(actor.handle)" class="hover:bg-muted flex items-center gap-3 p-3 transition-colors">
        <UAvatar :src="actor.avatar" :alt="actor.handle" size="sm" />
        <div class="min-w-0">
          <p class="truncate font-medium">{{ actor.displayName || actor.handle }}</p>
          <p class="text-muted truncate text-sm">@{{ actor.handle }}</p>
        </div>
        <UIcon name="i-lucide-chevron-right" class="text-muted ms-auto size-4" />
      </NuxtLink>
    </li>
  </ul>
</template>
