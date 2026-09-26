<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { isTier, TIER_ICONS, tierRank, type Tier } from '~/utils/tiers'

const { t } = useI18n()
const { summary, enabled } = useMotivation()
const authUser = useAuthUser()

const open = ref(false)
const tier = ref<Tier>('bronze')
const requested = useTierCelebration()
const particles = Array.from({ length: 12 }, (_, i) => ({ '--angle': `${i * 30}deg`, '--delay': `${(i % 4) * 0.18}s` }))

const profileLink = computed(() =>
  authUser.value ? `${profilePath(authUser.value.handle || authUser.value.did)}#tier` : '/profile',
)

watch(
  summary,
  (s) => {
    const did = authUser.value?.did
    if (!s || !did || !enabled.value) return
    const key = `opendeck-tier-seen:${did}`
    let seen: string | null = null
    try {
      seen = localStorage.getItem(key)
      localStorage.setItem(key, s.tier)
    } catch {
      return
    }
    if (isTier(seen) && tierRank(s.tier) > tierRank(seen)) requested.value = s.tier
  },
  { immediate: true },
)

watch(requested, (next) => {
  if (!next) return
  tier.value = next
  open.value = true
  requested.value = null
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('tier.newTier', { tier: t(`tier.names.${tier}`) })"
    :description="t('tier.celebrate')"
    :ui="{ content: 'max-w-sm overflow-hidden' }"
  >
    <template #content>
      <div :class="`tier-${tier}`" class="relative px-6 pt-4 pb-6 text-center">
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--tier-from)_30%,transparent),transparent_65%)]"
          aria-hidden="true"
        />
        <div class="relative mx-auto flex size-56 items-center justify-center" aria-hidden="true">
          <div class="tier-rays absolute inset-0" />
          <UIcon
            v-for="(style, i) in particles"
            :key="i"
            :name="TIER_ICONS[tier]"
            class="tier-particle size-5"
            :style="style"
          />
          <div
            class="tier-gradient tier-pop tier-ring relative flex size-24 items-center justify-center rounded-3xl text-neutral-950"
          >
            <UIcon :name="TIER_ICONS[tier]" class="size-12" />
          </div>
        </div>
        <div class="tier-rise-in relative space-y-1">
          <p class="text-muted text-xs font-medium tracking-wide uppercase">{{ $t('tier.promoted') }}</p>
          <p class="tier-text text-3xl font-bold tracking-tight">{{ $t(`tier.names.${tier}`) }}</p>
          <p class="text-muted text-sm">{{ $t('tier.celebrate') }}</p>
        </div>
        <div class="tier-rise-in relative mt-6 flex flex-row-reverse flex-wrap justify-center gap-2">
          <UButton :label="$t('tier.continue')" @click="open = false" />
          <UButton
            :to="profileLink"
            :label="$t('tier.showProfile')"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
