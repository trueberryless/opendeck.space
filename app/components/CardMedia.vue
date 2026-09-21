<script setup lang="ts">
const props = defineProps<{
  did: string
  image?: unknown
  imageAlt?: string
  audio?: unknown
}>()

const { blobUrl } = useMedia()
const imageUrl = ref<string | null>(null)
const audioUrl = ref<string | null>(null)

watchEffect(async () => {
  imageUrl.value = props.image ? await blobUrl(props.did, props.image) : null
})
watchEffect(async () => {
  audioUrl.value = props.audio ? await blobUrl(props.did, props.audio) : null
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
