<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead(() => ({ title: `${t('nav.profile')} · OpenDeck` }))

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
    <UIcon name="i-lucide-user" class="text-muted mx-auto size-10" />
    <h1 class="text-xl font-semibold">{{ $t('profile.yourProfile') }}</h1>
    <p class="text-muted text-sm">{{ $t('profile.signInBody') }}</p>
    <UButton to="/login" :label="$t('common.signIn')" icon="i-lucide-log-in" />
  </div>
  <div v-else class="text-muted py-16 text-center">
    <UIcon name="i-lucide-loader-circle" class="mx-auto size-6 animate-spin" aria-hidden="true" />
    <span class="sr-only" role="status">{{ $t('common.loading') }}</span>
  </div>
</template>
