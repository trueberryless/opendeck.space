import { authReady } from '~/composables/useAirspace'
import { getBskyProfile } from '~/utils/bsky'

export default defineNuxtPlugin(() => {
  void (async () => {
    await authReady
    const authUser = useAuthUser()
    if (!authUser.value) return

    const me = useMe()
    const { load } = useProfile()
    const airspace = useAirspace()

    await Promise.all([
      (async () => {
        const profile = await getBskyProfile(authUser.value!.did)
        if (profile) {
          me.value = profile
          authUser.value = { ...authUser.value!, handle: profile.handle }
        } else if (airspace) {
          try {
            const identity = await airspace.identity()
            if (identity.handle) authUser.value = { ...authUser.value!, handle: identity.handle }
          } catch {}
        }
      })(),
      load(),
    ])
  })()
})
