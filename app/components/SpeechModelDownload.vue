<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { downloadMegabytes, speechModel, type SpeechModelId } from '~/utils/speechModels'

const { model = 'base' } = defineProps<{ model?: SpeechModelId }>()

const { locale } = useI18n()
const models = useSpeechModels()
const info = computed(() => speechModel(model))
const state = computed(() => models.stateOf(model))
const size = computed(() =>
  info.value ? formatMegabytes(downloadMegabytes(info.value, models.runtimeCached.value), locale.value) : '',
)
const percent = computed(() => Math.round(state.value.progress * 100))

onMounted(() => {
  if (!models.checked.value) void models.refresh()
})
</script>

<template>
  <div class="space-y-2">
    <template v-if="state.status === 'downloading'">
      <div class="flex items-center gap-3">
        <UProgress
          :model-value="percent"
          :max="100"
          size="sm"
          class="flex-1"
          :aria-label="$t('practice.models.downloadingLabel')"
        />
        <span class="text-muted min-w-10 text-end text-xs tabular-nums" role="status">{{ percent }}%</span>
        <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" size="xs" @click="models.cancel(model)" />
      </div>
    </template>
    <template v-else-if="state.status !== 'ready'">
      <p v-if="state.status === 'error'" class="text-error text-sm" role="alert">
        {{ $t('practice.models.failed') }}
      </p>
      <UButton
        :icon="state.status === 'error' ? 'i-lucide-rotate-ccw' : 'i-lucide-download'"
        :label="state.status === 'error' ? $t('practice.models.retry') : $t('practice.models.download', { size })"
        color="neutral"
        variant="subtle"
        size="sm"
        :disabled="Boolean(models.downloading.value)"
        @click="models.download(model)"
      />
      <p class="text-muted text-xs">{{ $t('practice.models.downloadHelp') }}</p>
    </template>
  </div>
</template>
