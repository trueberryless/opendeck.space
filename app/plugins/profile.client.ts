import { authReady } from '~/composables/useAirspace'
import { ME_KEY } from '~/composables/useProfile'
import { getBskyProfile, type BskyProfile } from '~/utils/bsky'
import { getMeta, setMeta } from '~/utils/db'

export default defineNuxtPlugin(() => {
  const authUser = useAuthUser()
  const connected = useConnected()
  const me = useMe()
  const { load, loadCached } = useProfile()

  async function refresh() {
    const user = authUser.value
    if (!user) return
    const airspace = useAirspace()

    await Promise.all([
      (async () => {
        const profile = useSync().online.value ? await getBskyProfile(user.did) : null
        if (profile) {
          me.value = profile
          authUser.value = { ...authUser.value!, handle: profile.handle }
          await setMeta(ME_KEY, profile)
        } else if (airspace) {
          try {
            const identity = await airspace.identity()
            if (identity.handle) authUser.value = { ...authUser.value!, handle: identity.handle }
          } catch {}
        }
      })(),
      load(),
    ])
  }

  void (async () => {
    await authReady
    if (!authUser.value) return

    const cached = await getMeta<BskyProfile>(ME_KEY)
    if (cached && !me.value && cached.did === authUser.value.did) me.value = cached
    await loadCached()
    await refresh()

    watch(connected, (isConnected) => {
      if (isConnected) void refresh()
    })
  })()
})
