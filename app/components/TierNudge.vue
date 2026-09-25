<script setup lang="ts">
import { tierRank, type Tier } from '~/utils/tiers'

const props = defineProps<{ before?: Tier | null }>()

const { summary, enabled } = useMotivation()
const authUser = useAuthUser()

const promoted = computed(
  () => Boolean(props.before && summary.value) && tierRank(summary.value!.tier) > tierRank(props.before!),
)
const profileLink = computed(() =>
  authUser.value ? `${profilePath(authUser.value.handle || authUser.value.did)}#tier` : '/profile',
)
</script>

<template>
  <div
    v-if="enabled && summary"
    :class="`tier-${summary.tier}`"
    class="border-default relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 ps-4 text-start"
  >
    <div class="tier-gradient absolute inset-y-0 start-0 w-1" aria-hidden="true" />
    <TierBadge :tier="summary.tier" />
    <div class="min-w-0 flex-1 space-y-1.5">
      <p class="text-sm" role="status">
        <template v-if="promoted">{{ $t('tier.newTier', { tier: $t(`tier.names.${summary.tier}`) }) }}</template>
        <template v-else-if="summary.atRisk">
          {{ $t('tier.keep', { tier: $t(`tier.names.${summary.tier}`) }) }}
        </template>
        <template v-else-if="summary.next && summary.daysToNext">
          {{
            $t('tier.toNext', { count: summary.daysToNext, tier: $t(`tier.names.${summary.next}`) }, summary.daysToNext)
          }}
        </template>
        <template v-else>{{ $t('tier.top') }}</template>
      </p>
      <div
        v-if="summary.next && !promoted"
        class="h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        aria-hidden="true"
      >
        <div
          :class="`tier-${summary.next}`"
          class="tier-gradient h-full rounded-full"
          :style="{ width: `${Math.max(4, summary.progress * 100)}%` }"
        />
      </div>
    </div>
    <UButton
      :to="profileLink"
      :label="$t('tier.view')"
      trailing-icon="i-lucide-chevron-right"
      color="neutral"
      variant="ghost"
      size="sm"
      class="shrink-0"
    />
  </div>
</template>
