<script setup lang="ts">
const { current, setLocale, locales } = useLocale()

const items = computed(() =>
  locales.map((l) => ({
    label: l.name,
    type: 'checkbox' as const,
    checked: l.code === current.value,
    onSelect: () => setLocale(l.code),
  })),
)

const activeName = computed(() => locales.find((l) => l.code === current.value)?.name ?? current.value)
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-languages"
      :label="activeName"
      size="sm"
      :aria-label="`${$t('language.change')}: ${activeName}`"
    />
  </UDropdownMenu>
</template>
