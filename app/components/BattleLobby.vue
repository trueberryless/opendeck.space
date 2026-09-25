<script setup lang="ts">
import type { BattleView } from '~/utils/battle/game'

const props = defineProps<{
  view: BattleView
  isHost: boolean
  inviteUrl: string
  hostName: string
  me?: string
  host?: string
}>()
const emit = defineEmits<{ start: []; handicap: [on: boolean] }>()
const { canShare, copy, share } = useShareLink()

const handicap = computed({
  get: () => props.view.handicap,
  set: (on: boolean) => emit('handicap', on),
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="isHost" class="border-default grid items-center gap-6 rounded-xl border p-4 sm:grid-cols-[14rem_1fr]">
      <BattleQr :url="inviteUrl" :label="$t('battle.inviteTitle')" class="mx-auto" />
      <div class="space-y-3">
        <h2 class="font-semibold">{{ $t('battle.inviteTitle') }}</h2>
        <p class="text-muted text-sm">{{ $t('battle.inviteBody') }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton
            :label="$t('together.copyLink')"
            icon="i-lucide-link"
            color="neutral"
            variant="subtle"
            @click="copy(inviteUrl)"
          />
          <UButton
            v-if="canShare"
            :label="$t('together.share')"
            icon="i-lucide-share-2"
            color="neutral"
            variant="subtle"
            @click="share(inviteUrl, view.deck)"
          />
        </div>
      </div>
    </div>

    <section class="space-y-2">
      <h2 class="text-sm font-medium">
        {{ $t('battle.players', { count: view.players.length }, view.players.length) }}
      </h2>
      <BattlePlayers :players="view.players" phase="lobby" :me="me" :host="host" />
    </section>

    <SettingsRow
      v-if="isHost"
      v-model="handicap"
      :title="$t('battle.handicap')"
      :description="$t('battle.handicapBody')"
    />
    <p v-else-if="view.handicap" class="text-muted text-sm">{{ $t('battle.handicapBody') }}</p>

    <div v-if="isHost" class="space-y-2">
      <UButton
        :label="$t('battle.start')"
        icon="i-lucide-play"
        size="lg"
        :disabled="view.players.length < 2"
        @click="$emit('start')"
      />
      <p v-if="view.players.length < 2" class="text-muted text-sm" role="status">{{ $t('battle.needPlayers') }}</p>
    </div>
    <p v-else class="text-muted flex items-center gap-2 text-sm" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
      {{ $t('battle.waitingHost', { name: hostName }) }}
    </p>
  </div>
</template>
