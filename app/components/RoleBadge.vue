<script setup lang="ts">
import { ROLE_ICONS, type Credit } from '~/utils/credits'

defineProps<{ credit: Credit }>()
</script>

<template>
  <span
    :class="`role-${credit.role}`"
    class="role-badge inline-flex max-w-full items-center gap-1 rounded-full px-2 py-px text-xs font-semibold"
    :title="$t('roles.thanks')"
  >
    <UIcon :name="ROLE_ICONS[credit.role]" class="size-3.5 shrink-0" aria-hidden="true" />
    <span class="truncate">
      {{ $t(`roles.names.${credit.role}`) }}<template v-if="credit.note"> · {{ credit.note }}</template>
    </span>
  </span>
</template>
