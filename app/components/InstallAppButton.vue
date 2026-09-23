<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: 'xs' | 'sm' | 'md' }>(), { size: 'md' })
const { canPrompt, needsIosSteps, install } = useInstallApp()
const stepsOpen = ref(false)

async function onClick() {
  if (canPrompt.value) await install()
  else if (needsIosSteps.value) stepsOpen.value = true
}
</script>

<template>
  <UButton :label="$t('install.button')" icon="i-lucide-download" :size="props.size" @click="onClick" />
  <UModal v-model:open="stepsOpen" :title="$t('install.iosTitle')">
    <template #body>
      <ol class="space-y-4">
        <li class="flex items-start gap-3">
          <span class="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
            <UIcon name="i-lucide-share" class="size-4" />
          </span>
          <p class="pt-1 text-sm">{{ $t('install.iosStepShare') }}</p>
        </li>
        <li class="flex items-start gap-3">
          <span class="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
            <UIcon name="i-lucide-square-plus" class="size-4" />
          </span>
          <p class="pt-1 text-sm">{{ $t('install.iosStepAdd') }}</p>
        </li>
        <li class="flex items-start gap-3">
          <span class="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
            <UIcon name="i-lucide-check" class="size-4" />
          </span>
          <p class="pt-1 text-sm">{{ $t('install.iosStepConfirm') }}</p>
        </li>
      </ol>
    </template>
  </UModal>
</template>
