<script setup lang="ts">
const props = defineProps<{ share?: ReviewShare; original?: boolean }>()

const { current } = useLocale()

const percent = computed(() => {
  if (props.original || !props.share?.total) return undefined
  const { checked, total } = props.share
  const whole = Math.floor((checked * 100) / total)
  return new Intl.NumberFormat(current.value, { style: 'percent' }).format((checked > 0 ? Math.max(1, whole) : 0) / 100)
})

const badge = computed(() => {
  if (props.original) return { label: 'translations.original', color: 'primary', variant: 'subtle' } as const
  switch (props.share?.state) {
    case 'full':
      return {
        label: 'translations.checked',
        icon: 'i-lucide-badge-check',
        color: 'success',
        variant: 'subtle',
      } as const
    case 'partly':
      return {
        label: 'translations.partlyChecked',
        icon: 'i-lucide-badge-alert',
        color: 'warning',
        variant: 'subtle',
      } as const
    case 'none':
      return { label: 'translations.draft', color: 'neutral', variant: 'subtle' } as const
    default:
      return { label: 'translations.notTranslated', color: 'neutral', variant: 'outline' } as const
  }
})
</script>

<template>
  <div class="grid grid-cols-[2.75rem_auto] items-center justify-start gap-2">
    <span class="text-muted text-end text-xs tabular-nums">{{ percent }}</span>
    <UBadge
      :label="$t(badge.label)"
      :icon="'icon' in badge ? badge.icon : undefined"
      :color="badge.color"
      :variant="badge.variant"
      size="sm"
      class="justify-self-start"
    />
  </div>
</template>
