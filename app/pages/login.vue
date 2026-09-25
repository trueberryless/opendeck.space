<script setup lang="ts">
import { useI18n } from 'vue-i18n'

definePageMeta({ centered: true })
const { t } = useI18n()
useHead(() => ({ title: `${t('login.title')} · OpenDeck` }))

const route = useRoute()
const user = useAuthUser()
const identifier = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

watchEffect(() => {
  if (user.value) navigateTo((route.query.redirect as string) || '/')
})

async function signIn() {
  const value = identifier.value.trim()
  if (!value) return
  loading.value = true
  error.value = null
  try {
    await Promise.race([authReady, new Promise((resolve) => setTimeout(resolve, 10000))])
    const oauth = useOAuth()
    if (!oauth) throw new Error('OAuth client unavailable')
    try {
      sessionStorage.setItem(SIGNIN_HANDLE_KEY, value)
      const redirect = route.query.redirect
      if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
        sessionStorage.setItem(SIGNIN_REDIRECT_KEY, redirect)
      }
    } catch {}
    await oauth.signIn(value)
  } catch {
    error.value = t('login.error')
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm space-y-6 py-12">
    <div class="space-y-2 text-center">
      <Logo :size="44" class="mx-auto" decorative />
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('login.title') }}</h1>
      <p class="text-muted text-sm">{{ $t('login.subtitle') }}</p>
    </div>

    <form class="space-y-3" @submit.prevent="signIn">
      <UFormField :label="$t('login.handleLabel')" name="identifier">
        <UInput
          v-model="identifier"
          placeholder="alice.bsky.social"
          autocomplete="username"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          icon="i-lucide-at-sign"
          size="lg"
          class="w-full"
          :disabled="loading"
        />
      </UFormField>

      <UAlert
        v-if="error"
        role="alert"
        :description="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
      />

      <UButton
        type="submit"
        :label="$t('common.continue')"
        size="lg"
        block
        :loading="loading"
        :disabled="!identifier.trim()"
        trailing-icon="i-lucide-arrow-right"
      />
    </form>

    <p class="text-muted text-center text-xs">
      {{ $t('login.agreePre') }}
      <NuxtLink to="/terms" class="hover:text-accent underline">{{ $t('login.terms') }}</NuxtLink>
      {{ $t('login.agreeMid') }}
      <NuxtLink to="/privacy" class="hover:text-accent underline">{{ $t('login.privacyPolicy') }}</NuxtLink
      >{{ $t('login.agreeEnd') }}
    </p>
  </div>
</template>
