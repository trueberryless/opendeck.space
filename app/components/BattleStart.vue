<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DeckView } from '~/composables/useDecks'
import { canBattle } from '~/utils/battle/game'

const { t } = useI18n()
const decks = useDecks()
const battle = useBattle()
const authUser = useAuthUser()
const toast = useToast()

const list = ref<DeckView[]>([])
const selected = ref<string | undefined>()
const loading = ref(true)
const opening = ref(false)

const items = computed(() => list.value.map((d) => ({ value: d.rkey, label: d.value.title })))

onMounted(async () => {
  try {
    list.value = await decks.listMyDecks()
    selected.value = list.value[0]?.rkey
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
})

async function openRoom() {
  const deck = list.value.find((d) => d.rkey === selected.value)
  if (!deck || opening.value) return
  opening.value = true
  try {
    const cards = (await decks.listMyCards(deck.rkey, deck.visibility)).map((c) => ({
      front: c.value.front,
      back: c.value.back,
    }))
    if (!canBattle(cards)) {
      toast.add({ title: t('battle.tooFewCards'), color: 'warning', icon: 'i-lucide-layers' })
      return
    }
    const { id, key } = battle.hostBattle(deck.value.title, cards)
    await navigateTo(battlePath(authUser.value?.handle || authUser.value!.did, id, key))
  } catch (err) {
    toast.add({ title: t('battle.loadError'), description: String(err), color: 'error' })
  } finally {
    opening.value = false
  }
}
</script>

<template>
  <div class="border-default flex flex-wrap items-end gap-3 rounded-lg border p-4">
    <USkeleton v-if="loading" class="h-9 w-64" />
    <p v-else-if="list.length === 0" class="text-muted text-sm">{{ $t('battle.noDecks') }}</p>
    <template v-else>
      <UFormField :label="$t('battle.deck')" name="battle-deck" class="min-w-0 flex-1">
        <USelect v-model="selected" :items="items" :placeholder="$t('battle.pickDeck')" class="w-full" />
      </UFormField>
      <UButton :label="$t('battle.open')" icon="i-lucide-swords" :loading="opening" @click="openRoom" />
    </template>
  </div>
</template>
