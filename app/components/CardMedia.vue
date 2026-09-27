<script setup lang="ts">
const props = defineProps<{
  did: string
  image?: unknown
  imageAlt?: string
  audio?: unknown
}>()

const { blobUrl, releaseUrl } = useMedia()
const imageUrl = ref<string | null>(null)
const audioUrl = ref<string | null>(null)

function resolve(blob: () => unknown, target: Ref<string | null>) {
  watch(
    blob,
    async (value, _, onCleanup) => {
      let stale = false
      onCleanup(() => (stale = true))
      const url = value ? await blobUrl(props.did, value) : null
      if (stale) return releaseUrl(url)
      releaseUrl(target.value)
      target.value = url
    },
    { immediate: true },
  )
}

resolve(() => props.image, imageUrl)
resolve(() => props.audio, audioUrl)

onBeforeUnmount(() => {
  releaseUrl(imageUrl.value)
  releaseUrl(audioUrl.value)
})
</script>

<template>
  <div v-if="imageUrl || audioUrl" class="space-y-2">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="imageAlt || ''"
      loading="lazy"
      class="border-default mx-auto max-h-48 w-auto rounded-lg border object-contain"
    />
    <audio v-if="audioUrl" :src="audioUrl" controls class="w-full" />
  </div>
</template>
