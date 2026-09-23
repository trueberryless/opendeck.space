<script setup lang="ts">
useHead({ title: 'Profile · OpenDeck' })

const authUser = useAuthUser()
const isLoggedIn = useIsLoggedIn()

watchEffect(() => {
  if (authUser.value) {
    navigateTo(profilePath(authUser.value.handle || authUser.value.did), { replace: true })
  }
})
</script>

<template>
  <div v-if="!isLoggedIn" class="mx-auto max-w-sm space-y-4 py-16 text-center">
    <UIcon name="i-lucide-user" class="mx-auto size-10 text-neutral-400" />
    <h1 class="text-xl font-semibold">{{ $t('profile.yourProfile') }}</h1>
    <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('profile.signInBody') }}</p>
    <UButton to="/login" :label="$t('common.signIn')" icon="i-lucide-log-in" />
  </div>
  <div v-else class="py-16 text-center text-neutral-400">
    <UIcon name="i-lucide-loader-circle" class="mx-auto size-6 animate-spin" />
  </div>
</template>
