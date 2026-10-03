<script setup lang="ts">
const MAC_SPOKEN_CONTENT_URL = 'x-apple.systempreferences:com.apple.preference.universalaccess?SpokenContent'

const { firefox, platform } = useSpeechPlatform()
</script>

<template>
  <div class="border-default space-y-3 rounded-lg border p-4">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-audio-lines" class="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div class="min-w-0 space-y-2">
        <p class="font-medium">{{ $t('speech.getVoices') }}</p>
        <p class="text-muted text-sm">{{ $t('speech.getVoicesIntro') }}</p>
        <p class="text-sm">{{ $t(`speech.installSteps.${platform}`) }}</p>
        <p v-if="firefox && platform === 'macos'" class="text-sm">{{ $t('speech.firefoxMac') }}</p>
      </div>
    </div>
    <UButton
      v-if="platform === 'macos'"
      :href="MAC_SPOKEN_CONTENT_URL"
      icon="i-lucide-settings"
      :label="$t('speech.openSpokenContent')"
      color="neutral"
      variant="subtle"
    />
  </div>
</template>
