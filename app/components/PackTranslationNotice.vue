<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { StarterPack } from '~/composables/useStarterPacks'

const props = defineProps<{ pack: StarterPack; languages: string[] }>()
const { t, te, locale } = useI18n()

const unchecked = computed(() => [...new Set(props.languages)].filter((code) => !isPackChecked(props.pack, code)))

const names = computed(() =>
  new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(
    unchecked.value.map((code) => (te(`languages.${code}`) ? t(`languages.${code}`) : code)),
  ),
)
</script>

<template>
  <p v-if="unchecked.length" class="text-muted flex items-start gap-2 text-xs">
    <UIcon name="i-lucide-languages" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
    <span>
      {{ $t('translations.packNotice', { languages: names }) }}
      <a
        :href="translationCheckUrl(unchecked[0], pack.id)"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-(--accent) underline underline-offset-4 hover:opacity-80"
        >{{ $t('translations.packNoticeAction') }}</a
      >
    </span>
  </p>
</template>
