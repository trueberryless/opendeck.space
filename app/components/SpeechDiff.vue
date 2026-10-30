<script setup lang="ts">
import { comparesCharacters, type DiffKind, type DiffPart } from '~/utils/speechScore'

const { lang, parts } = defineProps<{ lang?: string; parts: DiffPart[] }>()

const KIND_CLASS: Record<DiffKind, string> = {
  same: 'text-success',
  changed: 'text-warning underline decoration-wavy underline-offset-4',
  missing: 'text-error line-through',
  extra: 'text-muted italic',
}

const characters = computed(() => comparesCharacters(lang))
</script>

<template>
  <p
    class="flex flex-wrap items-baseline text-base"
    :class="characters ? 'gap-x-0.5' : 'gap-x-1.5'"
    :lang="langAttr(lang)"
  >
    <span v-for="(part, i) in parts" :key="i" :class="KIND_CLASS[part.kind]">
      <template v-if="part.kind === 'extra'">+{{ part.heard }}</template>
      <template v-else>{{ part.expected }}</template>
      <span v-if="part.kind === 'changed'" class="sr-only">{{
        $t('practice.diff.changed', { heard: part.heard ?? '' })
      }}</span>
      <span v-else-if="part.kind !== 'same'" class="sr-only">{{ $t(`practice.diff.${part.kind}`) }}</span>
    </span>
  </p>
</template>
