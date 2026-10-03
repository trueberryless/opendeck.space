<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { isNaturalVoice, languageName, speechLanguage } from '~/utils/speech'

const AUTO = 'auto'

const { lang } = defineProps<{ lang: string }>()

const { locale, t } = useI18n()
const { preferredVoices, speak, voicesFor } = useSpeech()
const { platform } = useSpeechPlatform()
const language = computed(() => speechLanguage(lang) ?? lang)
const voices = computed(() => voicesFor(lang))
const items = computed(() => [
  { value: AUTO, label: t('speech.voiceAuto', { voice: voices.value[0]?.name ?? '' }) },
  ...voices.value.map((v) => ({
    value: v.voiceURI,
    label: v.localService ? v.name : t('speech.onlineVoice', { voice: v.name }),
  })),
])
const onlyBasicVoices = computed(
  () => ['ios', 'macos'].includes(platform.value) && !voices.value.some((v) => isNaturalVoice(v)),
)
const choice = computed({
  get: () => preferredVoices.value[language.value] ?? AUTO,
  set: (value: string) => {
    const others = Object.entries(preferredVoices.value).filter(([key]) => key !== language.value)
    preferredVoices.value = Object.fromEntries(value === AUTO ? others : [...others, [language.value, value]])
  },
})
</script>

<template>
  <div v-if="voices.length" class="space-y-1">
    <div class="flex flex-wrap items-end gap-2">
      <UFormField :label="languageName(lang, locale)" :name="`voice-${language}`" class="min-w-0">
        <USelect v-model="choice" :items="items" class="w-72 max-w-full" />
      </UFormField>
      <UButton
        icon="i-lucide-play"
        :label="$t('speech.test')"
        :aria-label="$t('speech.testVoice', { language: languageName(lang, locale) })"
        color="neutral"
        variant="subtle"
        @click="speak(languageName(lang), lang)"
      />
    </div>
    <p v-if="onlyBasicVoices" class="text-muted text-sm">{{ $t('speech.basicVoiceOnly') }}</p>
  </div>
</template>
