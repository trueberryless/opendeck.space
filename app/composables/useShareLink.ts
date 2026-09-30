import { useI18n } from 'vue-i18n'

export function useShareLink() {
  const { t } = useI18n()
  const toast = useToast()
  const canShare = computed(() => import.meta.client && typeof navigator.share === 'function')

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.add({ title: t('together.copied'), icon: 'i-lucide-check', color: 'success' })
    } catch {
      toast.add({ title: url, color: 'neutral' })
    }
  }

  async function share(url: string, title: string) {
    try {
      await navigator.share({ url, title })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') await copy(url)
    }
  }

  return { canShare, copy, share }
}
