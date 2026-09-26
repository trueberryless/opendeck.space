<script setup lang="ts">
import type { BskyProfile } from '~/utils/bsky'
import type { ChallengeKind, Standing } from '~/utils/challenges'

defineProps<{
  rows: Standing[]
  kind: ChallengeKind
  profiles: Map<string, BskyProfile>
  me?: string
  ended: boolean
}>()
</script>

<template>
  <ol class="divide-default border-default divide-y overflow-hidden rounded-lg border">
    <li
      v-for="row in rows"
      :key="row.did"
      class="space-y-2 p-3"
      :class="row.did === me ? 'bg-(--ui-bg-muted)' : ''"
      :aria-current="row.did === me ? 'true' : undefined"
    >
      <div class="flex items-center gap-3">
        <span class="w-6 shrink-0 text-center text-sm font-semibold tabular-nums">
          <UIcon
            v-if="ended && row.rank === 1"
            name="i-lucide-trophy"
            class="text-accent size-5 align-middle"
            :aria-label="String(row.rank)"
          />
          <template v-else>{{ row.rank }}</template>
        </span>
        <UAvatar :src="profiles.get(row.did)?.avatar" :alt="profiles.get(row.did)?.handle ?? row.did" size="sm" />
        <NuxtLink :to="profilePath(profiles.get(row.did)?.handle ?? row.did)" class="min-w-0 flex-1 hover:underline">
          <span class="block truncate text-sm font-medium">
            {{ profiles.get(row.did)?.displayName || profiles.get(row.did)?.handle || row.did }}
            <span v-if="row.did === me" class="text-muted font-normal">({{ $t('together.you') }})</span>
          </span>
        </NuxtLink>
        <span class="text-muted shrink-0 text-sm tabular-nums" :class="row.out ? 'line-through' : ''">
          <template v-if="kind === 'studyDays'">
            {{ $t('challenges.studyDays', { count: row.studied }, row.studied) }}
          </template>
          <template v-else-if="row.out">{{ $t('challenges.out', { count: row.survived }, row.survived) }}</template>
          <template v-else>{{ $t('challenges.standing', { count: row.survived }, row.survived) }}</template>
        </span>
      </div>
      <div class="flex gap-0.5 ps-9" aria-hidden="true">
        <span
          v-for="(mark, i) in row.marks"
          :key="i"
          class="h-2 min-w-0 flex-1 rounded-sm"
          :class="
            mark === 'done' ? 'bg-accent' : mark === 'missed' ? 'bg-error/60' : 'bg-neutral-200 dark:bg-neutral-800'
          "
        />
      </div>
    </li>
  </ol>
</template>
