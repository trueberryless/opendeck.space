import { authReady } from '~/composables/useAirspace'

export default defineNuxtPlugin(() => {
  const { online, flush, refreshPending } = useSync()
  const authUser = useAuthUser()

  watch(online, (isOnline) => {
    if (isOnline && authUser.value) flush()
  })

  void (async () => {
    await authReady
    await refreshPending()
    if (online.value && authUser.value) flush()
  })()
})
