<script setup lang="ts">
import { ANKI_CONNECT_ADDON, ANKI_CONNECT_ADDON_URL } from '~/utils/ankiConnect'

const emit = defineEmits<{ connected: [] }>()
const { status, problem, detail, key, setKey, connect } = useAnkiConnect()
const keyInput = ref(key.value)

async function onConnect() {
  if (problem.value === 'key') setKey(keyInput.value)
  if (await connect()) emit('connected')
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="status === 'connected'" role="status" class="text-accent flex items-center gap-2 text-sm font-medium">
      <UIcon name="i-lucide-plug-zap" class="size-4" aria-hidden="true" />
      {{ $t('anki.connected') }}
    </p>
    <template v-else>
      <ol class="list-inside list-decimal space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
        <li>
          <i18n-t keypath="anki.setupInstall" tag="span">
            <template #code>
              <a
                :href="ANKI_CONNECT_ADDON_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="text-accent underline"
                >{{ ANKI_CONNECT_ADDON }}</a
              >
            </template>
          </i18n-t>
        </li>
        <li>{{ $t('anki.setupOpen') }}</li>
        <li>{{ $t('anki.setupAllow') }}</li>
      </ol>

      <UAlert
        v-if="problem"
        role="alert"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="$t(`anki.problems.${problem}`)"
        :description="detail || undefined"
      />

      <UFormField v-if="problem === 'key'" :label="$t('anki.apiKey')" :hint="$t('anki.apiKeyHint')">
        <UInput v-model="keyInput" type="password" autocomplete="off" class="w-full" />
      </UFormField>

      <UButton :label="$t('anki.connect')" icon="i-lucide-plug" :loading="status === 'connecting'" @click="onConnect" />
    </template>
  </div>
</template>
