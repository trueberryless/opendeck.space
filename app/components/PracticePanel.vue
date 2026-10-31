<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Practice } from '~/composables/usePractice'
import { languageName } from '~/utils/speech'
import { scoreLevel } from '~/utils/speechModels'

const { always = false, practice } = defineProps<{ always?: boolean; practice: Practice }>()

const { locale } = useI18n()
const recorder = practice.recorder
const models = practice.models
const visible = computed(
  () =>
    always ||
    practice.asking.value ||
    recorder.state.value !== 'idle' ||
    Boolean(recorder.recording.value) ||
    Boolean(recorder.failure.value),
)
const language = computed(() => languageName(practice.current.value.lang ?? '', locale.value))
const result = computed(() => practice.result.value)
const level = computed(() => (result.value ? scoreLevel(result.value.score) : 'again'))
const LEVEL_CLASS = { great: 'text-success', close: 'text-warning', again: 'text-error' } as const
const percent = computed(() =>
  new Intl.NumberFormat(locale.value, { style: 'percent' }).format((result.value?.score ?? 0) / 100),
)
</script>

<template>
  <div
    v-if="visible"
    class="border-default bg-default w-full space-y-3 rounded-xl border p-3 text-start text-sm"
    @click.stop
    @pointerdown.stop
  >
    <div v-if="practice.asking.value" class="space-y-2">
      <p>{{ $t('practice.micExplain') }}</p>
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-mic" :label="$t('practice.micAllow')" size="sm" @click="practice.allowMic()" />
        <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" size="sm" @click="practice.reset()" />
      </div>
    </div>

    <p v-else-if="recorder.failure.value" class="text-error" role="alert">
      {{ $t(`practice.micFailures.${recorder.failure.value}`) }}
    </p>

    <p v-else-if="recorder.state.value !== 'idle'" class="flex items-center gap-2" role="status">
      <span class="bg-error size-2 shrink-0 animate-pulse rounded-full" aria-hidden="true" />
      {{ $t('practice.recording') }}
    </p>

    <p v-else-if="!recorder.recording.value" class="text-muted">{{ $t('practice.idle') }}</p>

    <template v-if="recorder.recording.value && recorder.state.value === 'idle'">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="$t('practice.playback')">
        <UButton
          v-if="practice.canPlayNative.value"
          :icon="practice.playing.value === 'native' ? 'i-lucide-square' : 'i-lucide-volume-2'"
          :label="$t('practice.playNative')"
          color="neutral"
          variant="subtle"
          size="xs"
          @click="practice.playing.value === 'native' ? practice.stopPlayback() : practice.playNative()"
        />
        <UButton
          :icon="practice.playing.value === 'own' ? 'i-lucide-square' : 'i-lucide-play'"
          :label="$t('practice.playOwn')"
          color="neutral"
          variant="subtle"
          size="xs"
          @click="practice.playing.value === 'own' ? practice.stopPlayback() : practice.playOwn()"
        />
      </div>

      <div class="border-default space-y-2 border-t pt-3" aria-live="polite">
        <template v-if="result">
          <p class="font-medium">
            <span :class="LEVEL_CLASS[level]">{{ $t(`practice.levels.${level}`) }}</span>
            <span class="text-muted"> · {{ $t('practice.score', { score: percent }) }}</span>
          </p>
          <SpeechDiff :parts="result.parts" :lang="practice.current.value.lang" />
          <p class="text-muted text-xs">
            {{ $t('practice.heard') }}
            <span :lang="langAttr(practice.current.value.lang)">{{ result.heard || '…' }}</span>
          </p>
          <p class="text-muted text-xs">{{ $t('practice.caveat') }}</p>
        </template>
        <p v-else-if="!practice.canCheck.value" class="text-muted text-xs">
          {{ $t('practice.checkUnavailable', { language }) }}
        </p>
        <p v-else-if="practice.checking.value" class="text-muted flex items-center gap-2" role="status">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
          {{ $t('practice.checking') }}
        </p>
        <template v-else-if="models.active.value">
          <p v-if="practice.checkFailed.value" class="text-error" role="alert">{{ $t('practice.checkFailed') }}</p>
          <UButton
            icon="i-lucide-audio-lines"
            :label="$t('practice.check')"
            color="neutral"
            variant="subtle"
            size="sm"
            @click="practice.check()"
          />
        </template>
        <template v-else>
          <p class="text-muted text-xs">{{ $t('practice.checkIntro') }}</p>
          <SpeechModelDownload />
        </template>
      </div>
    </template>
  </div>
</template>
