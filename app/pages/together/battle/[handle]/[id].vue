<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getBskyProfile, type BskyProfile } from '~/utils/bsky'
import { isKey } from '~/utils/battle/crypto'

const { t } = useI18n()
const route = useRoute()
const authUser = useAuthUser()
const isLoggedIn = useIsLoggedIn()
const battle = useBattle()
const { state } = battle

const id = computed(() => route.params.id as string)
const key = computed(() => new URLSearchParams(route.hash.slice(1)).get('k'))
const hostProfile = ref<BskyProfile | null>(null)
const resolving = ref(true)

const me = computed(() => authUser.value?.did)
const hostDid = computed(() => hostProfile.value?.did ?? null)
const hostName = computed(() => hostProfile.value?.displayName || hostProfile.value?.handle || '')
const inRoom = computed(() => state.value.id === id.value && state.value.role !== null)
const isHost = computed(() => inRoom.value && state.value.role === 'host')
const expired = computed(() => !inRoom.value && Boolean(me.value) && me.value === hostDid.value)
const invalid = computed(() => !resolving.value && (!hostDid.value || !isKey(key.value)))
const inviteUrl = computed(() =>
  import.meta.client && key.value
    ? `${window.location.origin}${battlePath(route.params.handle as string, id.value, key.value)}`
    : '',
)
const loginLink = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`)

useHead(() => ({ title: `${t('battle.title')} · OpenDeck` }))

onMounted(async () => {
  hostProfile.value = await getBskyProfile(route.params.handle as string).catch(() => null)
  resolving.value = false
})

function join() {
  if (!hostDid.value || !isKey(key.value)) return
  battle.join(hostDid.value, id.value, key.value).catch(() => undefined)
}

function close() {
  battle.leave()
  return navigateTo('/together')
}

function leaveOnUnload() {
  battle.leave()
}

onMounted(() => window.addEventListener('pagehide', leaveOnUnload))
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', leaveOnUnload)
  if (inRoom.value) battle.leave()
})
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <div class="flex items-center gap-2">
      <UButton
        to="/together"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="$t('battle.back')"
      />
      <div class="min-w-0">
        <h1 class="truncate font-semibold">{{ state.view?.deck || $t('battle.title') }}</h1>
        <p v-if="hostName" class="text-muted truncate text-xs">{{ $t('battle.hostedBy', { name: hostName }) }}</p>
      </div>
    </div>

    <USkeleton v-if="resolving" class="h-40 w-full" />

    <template v-else-if="inRoom && state.status === 'connected' && state.view">
      <BattleLobby
        v-if="state.view.phase === 'lobby'"
        :view="state.view"
        :is-host="isHost"
        :invite-url="inviteUrl"
        :host-name="hostName"
        :me="me"
        :host="hostDid ?? undefined"
        @start="battle.start()"
        @handicap="battle.setHandicap"
      />
      <BattleResults
        v-else-if="state.view.phase === 'finished'"
        :view="state.view"
        :is-host="isHost"
        :me="me"
        @again="battle.start()"
        @close="close"
      />
      <BattleQuestion
        v-else
        :view="state.view"
        :view-at="state.viewAt"
        :choice="state.choice"
        :me="me"
        :host="hostDid ?? undefined"
        @answer="battle.answer"
      />
    </template>

    <div
      v-else-if="inRoom && state.status === 'connecting'"
      class="border-default space-y-2 rounded-xl border p-8 text-center"
      role="status"
    >
      <UIcon name="i-lucide-loader-circle" class="text-accent mx-auto size-8 animate-spin" aria-hidden="true" />
      <p class="font-medium">{{ $t('battle.connecting', { name: hostName }) }}</p>
      <p class="text-muted text-sm">{{ $t('battle.connectingHint') }}</p>
    </div>

    <UAlert
      v-else-if="inRoom && state.status === 'failed'"
      icon="i-lucide-wifi-off"
      color="warning"
      variant="subtle"
      :title="$t('battle.failedTitle')"
      :description="$t('battle.failedBody')"
      :actions="[{ label: $t('battle.retry'), onClick: join }]"
    />

    <UAlert
      v-else-if="inRoom && (state.status === 'closed' || state.status === 'full')"
      icon="i-lucide-door-closed"
      color="neutral"
      variant="subtle"
      :title="state.status === 'full' ? $t('battle.fullTitle') : $t('battle.closedTitle')"
      :description="state.status === 'full' ? undefined : $t('battle.closedBody')"
      :actions="[{ label: $t('battle.back'), onClick: close }]"
    />

    <UAlert
      v-else-if="invalid"
      icon="i-lucide-link-2-off"
      color="neutral"
      variant="subtle"
      :title="$t('battle.invalidTitle')"
      :description="$t('battle.invalidBody')"
    />

    <UAlert
      v-else-if="expired"
      icon="i-lucide-door-closed"
      color="neutral"
      variant="subtle"
      :title="$t('battle.expiredTitle')"
      :description="$t('battle.expiredBody')"
      :actions="[{ label: $t('battle.back'), to: '/together' }]"
    />

    <div v-else class="border-default space-y-4 rounded-xl border p-6 text-center">
      <UAvatar :src="hostProfile?.avatar" :alt="hostName" size="3xl" class="mx-auto" />
      <h2 class="text-lg font-semibold">{{ $t('battle.invited', { name: hostName }) }}</h2>
      <p class="text-muted mx-auto max-w-md text-sm">{{ $t('battle.joinBody') }}</p>
      <UButton v-if="isLoggedIn" :label="$t('battle.join')" icon="i-lucide-swords" size="lg" @click="join" />
      <UButton v-else :to="loginLink" :label="$t('battle.signInToJoin')" icon="i-lucide-log-in" size="lg" />
    </div>
  </div>
</template>
