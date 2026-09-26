import { authReady } from '~/composables/useAirspace'
import { getBskyProfile } from '~/utils/bsky'

async function isNewcomer(path: string): Promise<boolean> {
  if (!useProfile().fresh.value || path !== '/') return false
  const decks = await useDecks()
    .listMyDecks()
    .catch(() => null)
  return decks !== null && decks.length === 0
}

export default defineNuxtPlugin(() => {
  const router = useRouter()
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

    if (await isNewcomer(router.currentRoute.value.path)) await router.replace('/welcome')
    await useMotivation().refresh()
  })()
})
