<script setup lang="ts">
definePageMeta({ centered: true })
useHead({ title: 'Sign in · OpenDeck' })

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
    } catch {}
    await oauth.signIn(value)
  } catch {
    error.value = 'Could not start sign-in. Check the handle or PDS address and try again.'
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm space-y-6 py-12">
    <div class="space-y-2 text-center">
      <Logo :size="44" class="mx-auto" />
      <h1 class="text-2xl font-bold tracking-tight">Sign in to OpenDeck</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Use any ATproto account, whether Bluesky or your own PDS. You authenticate directly with your provider.
      </p>
    </div>

    <form class="space-y-3" @submit.prevent="signIn">
      <UFormField label="Handle or PDS" name="identifier">
        <UInput
          v-model="identifier"
          placeholder="alice.bsky.social"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          icon="i-lucide-at-sign"
          size="lg"
          class="w-full"
          :disabled="loading"
        />
      </UFormField>

      <UAlert v-if="error" :description="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" />

      <UButton
        type="submit"
        label="Continue"
        size="lg"
        block
        :loading="loading"
        :disabled="!identifier.trim()"
        trailing-icon="i-lucide-arrow-right"
      />
    </form>

    <p class="text-center text-xs text-neutral-400">
      By continuing you agree to our
      <NuxtLink to="/terms" class="hover:text-accent underline">Terms</NuxtLink>
      and
      <NuxtLink to="/privacy" class="hover:text-accent underline">Privacy Policy</NuxtLink>.
    </p>
  </div>
</template>
