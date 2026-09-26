import { ScopeError } from 'airspace'
import { useI18n } from 'vue-i18n'

export function isScopeError(err: unknown): boolean {
  return err instanceof ScopeError || /\bscope\b/i.test(String((err as Error)?.message ?? err))
}

async function signInAgain() {
  const oauth = useOAuth()
  const user = useAuthUser().value
  if (!oauth || !user) return
  const handle = user.handle || user.did
  try {
    sessionStorage.setItem(SIGNIN_HANDLE_KEY, handle)
    sessionStorage.setItem(
      SIGNIN_REDIRECT_KEY,
      window.location.pathname + window.location.search + window.location.hash,
    )
  } catch {}
  await oauth.signIn(handle)
}

export function useReauth() {
  const { t } = useI18n()
  const toast = useToast()

  function report(err: unknown, title: string) {
    console.error('[opendeck]', err)
    if (isScopeError(err)) {
      toast.add({
        title: t('together.reauthTitle'),
        description: t('together.reauthBody'),
        color: 'warning',
        icon: 'i-lucide-key-round',
        actions: [{ label: t('together.reauthAction'), onClick: () => void signInAgain() }],
      })
    } else {
      toast.add({ title, description: String((err as Error)?.message ?? err), color: 'error' })
    }
  }

  return { report }
}
