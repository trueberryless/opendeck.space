<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatMegabytes, SPEECH_MODELS, type SpeechModelId } from '~/utils/speechModels'

const { locale, t } = useI18n()
const models = useSpeechModels()

onMounted(() => void models.refresh())

const used = computed(() =>
  models.usage.value === null ? null : formatMegabytes(models.usage.value / 1_000_000, locale.value),
)
const choice = computed({
  get: () => models.active.value,
  set: (value: SpeechModelId | undefined) => (models.preferred.value = value ?? ''),
})
const choiceItems = computed(() =>
  models.ready.value.map((id) => ({ value: id, label: t(`practice.models.names.${id}`) })),
)

function sizeOf(id: SpeechModelId, megabytes: number): string {
  const bytes = models.sizes.value[id]
  return formatMegabytes(bytes ? bytes / 1_000_000 : megabytes, locale.value)
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <p class="text-sm font-medium">{{ $t('practice.models.title') }}</p>
      <p class="text-muted text-sm">{{ $t('practice.models.intro') }}</p>
    </div>
    <ul class="divide-default border-default divide-y rounded-lg border">
      <li v-for="model in SPEECH_MODELS" :key="model.id" class="space-y-2 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium">{{ $t(`practice.models.names.${model.id}`) }}</p>
            <p class="text-muted text-sm">
              {{ $t(`practice.models.hints.${model.id}`) }} · {{ sizeOf(model.id, model.megabytes) }}
            </p>
          </div>
          <UBadge
            :label="$t(`practice.models.status.${models.stateOf(model.id).status}`)"
            :color="models.stateOf(model.id).status === 'ready' ? 'success' : 'neutral'"
            variant="subtle"
          />
        </div>
        <ConfirmPopover
          v-if="models.stateOf(model.id).status === 'ready'"
          :title="$t('practice.models.deleteConfirm', { model: $t(`practice.models.names.${model.id}`) })"
          :description="$t('practice.models.deleteConfirmBody')"
          @confirm="models.remove(model.id)"
        >
          <UButton
            :label="$t('practice.models.delete')"
            :aria-label="$t('practice.models.deleteModel', { model: $t(`practice.models.names.${model.id}`) })"
            icon="i-lucide-trash-2"
            color="error"
            variant="subtle"
            size="sm"
          />
        </ConfirmPopover>
        <SpeechModelDownload v-else :model="model.id" />
      </li>
    </ul>
    <UFormField
      v-if="choiceItems.length > 1"
      :label="$t('practice.models.use')"
      :description="$t('practice.models.useHelp')"
      name="speechModel"
    >
      <USelect v-model="choice" :items="choiceItems" class="w-56" />
    </UFormField>
    <p v-if="used" class="text-muted text-xs">{{ $t('practice.models.storage', { size: used }) }}</p>
  </div>
</template>
