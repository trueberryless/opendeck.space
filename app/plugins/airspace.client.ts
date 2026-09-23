import { createAirspace } from 'airspace'
import { createBrowserOAuth } from 'airspace/oauth/browser'
import { collections, spaces } from '~~/shared/atproto/collections'
import { clientMetadataOptions, fallbackScopes } from '~~/shared/atproto/oauth'

export default defineNuxtPlugin(() => {
  const authUser = useAuthUser()
  const origin = window.location.origin

  void (async () => {
    let oauth: Awaited<ReturnType<typeof createBrowserOAuth>>
    try {
      oauth = await createBrowserOAuth({
        ...clientMetadataOptions(origin),
        allowHttp: origin.startsWith('http://'),
      })
      _setOAuth(oauth)
    } catch (err) {
      console.error('[opendeck] OAuth client init failed', err)
      _markAuthReady()
      return
    }

    try {
      const result = await oauth.init()
      if (result) {
        await clearIfAccountChanged(result.did)

        const airspace = createAirspace({
          identity: result.did,
          collections,
          spaces,
          session: result.session,
        })
        _setAirspace(airspace)
        authUser.value = { did: result.did, handle: null }
        safeRemove(SIGNIN_HANDLE_KEY)
        safeRemove(SIGNIN_RETRY_KEY)
        if (result.state && window.location.hash) {
          history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      }
    } catch (err) {
      const message = String((err as Error)?.message ?? err)
      const handle = safeGet(SIGNIN_HANDLE_KEY)
      const alreadyRetried = safeGet(SIGNIN_RETRY_KEY)
      const isScopeError = /scope|space declaration|retrieve space/i.test(message)
      if (handle && !alreadyRetried && isScopeError) {
        safeSet(SIGNIN_RETRY_KEY, '1')
        try {
          await oauth.signIn(handle, { scopes: fallbackScopes })
          return
        } catch (retryErr) {
          console.error('[opendeck] scope-fallback sign-in failed', retryErr)
        }
      }
      safeRemove(SIGNIN_HANDLE_KEY)
      safeRemove(SIGNIN_RETRY_KEY)
      console.error('[opendeck] OAuth init failed', err)
    } finally {
      _markAuthReady()
    }
  })()
})

const LAST_DID_KEY = 'opendeck-last-did'

async function clearIfAccountChanged(did: string): Promise<void> {
  let last: string | null = null
  try {
    last = localStorage.getItem(LAST_DID_KEY)
  } catch {
    last = null
  }
  if (last && last !== did) {
    try {
      await clearLocalData()
    } catch (err) {
      console.error('[opendeck] failed to clear local data on account switch', err)
    }
    try {
      localStorage.removeItem('opendeck-accent')
      localStorage.removeItem('opendeck-last-reminder')
    } catch {}
  }
  try {
    localStorage.setItem(LAST_DID_KEY, did)
  } catch {}
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {}
}
function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {}
}
