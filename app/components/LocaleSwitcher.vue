<script setup lang="ts">
const { current, setLocale, locales } = useLocale()

const items = computed(() =>
  locales.map((l) => ({
    label: l.name,
    onSelect: () => setLocale(l.code),
    icon: l.code === current.value ? 'i-lucide-check' : undefined,
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
      :aria-label="$t('language.change')"
    />
  </UDropdownMenu>
</template>
