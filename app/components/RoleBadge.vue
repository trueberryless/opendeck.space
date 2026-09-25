<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ROLE_ICONS, type Credit } from '~/utils/credits'

const props = defineProps<{ credit: Credit }>()
const { t, locale } = useI18n()

const detail = computed(() => {
  if (props.credit.languages?.length) {
    const names = new Intl.DisplayNames(locale.value, { type: 'language' })
    return new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(
      props.credit.languages.map((code) => names.of(code) ?? code),
    )
  }
  return props.credit.note
})
</script>

<template>
  <span
    :class="`role-${credit.role}`"
    class="role-badge inline-flex max-w-full items-center gap-1 rounded-full px-2 py-px text-xs font-semibold"
    :title="t('roles.thanks')"
  >
    <UIcon :name="ROLE_ICONS[credit.role]" class="size-3.5 shrink-0" aria-hidden="true" />
    <span class="truncate">
      {{ $t(`roles.names.${credit.role}`) }}<template v-if="detail"> · {{ detail }}</template>
    </span>
  </span>
</template>
