<script setup lang="ts">
const { restoreAccent } = useAccent()
onMounted(restoreAccent)

const { current, dir } = useLocale()

useHead({
  htmlAttrs: {
    lang: current,
    dir,
  },
})
</script>

<template>
  <UApp>
    <NuxtPwaManifest />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
