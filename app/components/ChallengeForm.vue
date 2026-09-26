<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CHALLENGE_KINDS, CHALLENGE_WEEKS, type ChallengeKind } from '~/utils/challenges'
import type { ChallengeView } from '~/composables/useChallenges'

const emit = defineEmits<{ created: [challenge: ChallengeView] }>()
const { t } = useI18n()
const challenges = useChallenges()
const reauth = useReauth()

const open = ref(false)
const title = ref('')
const kind = ref<ChallengeKind>('studyDays')
const weeks = ref<(typeof CHALLENGE_WEEKS)[number]>(2)
const saving = ref(false)

const kindItems = computed(() =>
  CHALLENGE_KINDS.map((k) => ({
    value: k,
    label: t(`challenges.kinds.${k}`),
    description: t(`challenges.kinds.${k}Body`),
  })),
)
const weekItems = computed(() =>
  CHALLENGE_WEEKS.map((w) => ({ value: w, label: t('challenges.weeks', { count: w }, w) })),
)

async function submit() {
  if (!title.value.trim() || saving.value) return
  saving.value = true
  try {
    const created = await challenges.create({ title: title.value, kind: kind.value, weeks: weeks.value })
    title.value = ''
    open.value = false
    emit('created', created)
  } catch (err) {
    reauth.report(err, t('challenges.createError'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <UButton
      v-if="!open"
      :label="$t('challenges.new')"
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      @click="open = true"
    />
    <form v-else class="border-default space-y-4 rounded-lg border p-4" @submit.prevent="submit">
      <UFormField :label="$t('challenges.name')" name="title" required>
        <UInput
          v-model="title"
          :placeholder="$t('challenges.namePlaceholder')"
          :maxlength="100"
          class="w-full"
          autofocus
        />
      </UFormField>
      <URadioGroup
        v-model="kind"
        :items="kindItems"
        variant="card"
        :legend="$t('challenges.kind')"
        :ui="{ legend: 'mb-2 text-sm font-medium' }"
      />
      <UFormField :label="$t('challenges.duration')" name="weeks">
        <USelect v-model="weeks" :items="weekItems" class="w-40" />
      </UFormField>
      <div class="flex flex-wrap gap-2">
        <UButton type="submit" :label="$t('challenges.create')" :loading="saving" :disabled="!title.trim()" />
        <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      </div>
    </form>
  </div>
</template>
