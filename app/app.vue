<script setup lang="ts">
useAccent()

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
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
