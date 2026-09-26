<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { challengeStatus } from '~/utils/challenges'
import type { ChallengeView, EntryView } from '~/composables/useChallenges'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
useHead(() => ({ title: `${t('together.title')} · OpenDeck` }))

const challenges = useChallenges()
const authUser = useAuthUser()
const toast = useToast()

const mine = ref<{ challenge: ChallengeView; entry: EntryView }[]>([])
const suggested = ref<ChallengeView[]>([])
const loading = ref(true)

const running = computed(() => mine.value.filter((r) => challengeStatus(r.challenge.value) !== 'ended'))
const finished = computed(() => mine.value.filter((r) => challengeStatus(r.challenge.value) === 'ended'))

async function load() {
  loading.value = true
  try {
    const [joined, followed] = await Promise.all([challenges.mine(), challenges.fromFollows().catch(() => [])])
    mine.value = joined
    const uris = new Set(joined.map((r) => r.challenge.uri))
    suggested.value = followed.filter((c) => !uris.has(c.uri))
  } catch (err) {
    console.error(err)
    toast.add({ title: t('challenges.loadError'), description: String(err), color: 'error' })
  } finally {
    loading.value = false
  }
}

function open(challenge: ChallengeView) {
  const actor = challenge.did === authUser.value?.did ? authUser.value.handle || challenge.did : challenge.did
  return navigateTo(challengePath(actor, challenge.rkey))
}

onMounted(load)
</script>

<template>
  <div class="space-y-10">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('together.title') }}</h1>
      <p class="text-muted text-sm">{{ $t('together.intro') }}</p>
    </header>

    <section class="space-y-3" aria-labelledby="battle-heading">
      <div>
        <h2 id="battle-heading" class="text-lg font-semibold">{{ $t('battle.title') }}</h2>
        <p class="text-muted text-sm">{{ $t('battle.intro') }}</p>
      </div>
      <BattleStart />
    </section>

    <section class="space-y-4" aria-labelledby="challenges-heading">
      <div>
        <h2 id="challenges-heading" class="text-lg font-semibold">{{ $t('challenges.title') }}</h2>
        <p class="text-muted text-sm">{{ $t('challenges.intro') }}</p>
      </div>

      <ChallengeForm @created="open" />

      <div v-if="loading" class="grid gap-3 sm:grid-cols-2">
        <USkeleton v-for="i in 2" :key="i" class="h-20 w-full" />
      </div>
      <template v-else>
        <div class="space-y-2">
          <h3 class="text-sm font-medium">{{ $t('challenges.yours') }}</h3>
          <p v-if="running.length === 0" class="text-muted text-sm">{{ $t('challenges.none') }}</p>
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <ChallengeCard v-for="r in running" :key="r.entry.uri" :challenge="r.challenge" @open="open" />
          </div>
        </div>

        <div v-if="suggested.length > 0" class="space-y-2">
          <h3 class="text-sm font-medium">{{ $t('challenges.fromFollows') }}</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <ChallengeCard v-for="c in suggested" :key="c.uri" :challenge="c" @open="open" />
          </div>
        </div>

        <details v-if="finished.length > 0" class="space-y-2">
          <summary class="cursor-pointer text-sm font-medium select-none">
            {{ $t('challenges.past') }} ({{ finished.length }})
          </summary>
          <div class="mt-2 grid gap-3 sm:grid-cols-2">
            <ChallengeCard v-for="r in finished" :key="r.entry.uri" :challenge="r.challenge" @open="open" />
          </div>
        </details>
      </template>
    </section>
  </div>
</template>
