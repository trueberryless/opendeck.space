import { authReady } from '~/composables/useAirspace'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  await authReady

  const user = useAuthUser()
  if (!user.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
