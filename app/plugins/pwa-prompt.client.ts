export default defineNuxtPlugin((nuxtApp) => {
  const toast = useToast()
  const t = (key: string) => (nuxtApp.vueApp.config.globalProperties.$t as (key: string) => string)(key)

  nuxtApp.hook('app:mounted', () => {
    const pwa = nuxtApp.$pwa as { needRefresh: boolean; updateServiceWorker: () => Promise<void> }
    let shown = false
    watch(
      () => pwa.needRefresh,
      (needed) => {
        if (!needed) {
          if (shown) toast.remove('pwa-update')
          shown = false
          return
        }
        shown = true
        toast.add({
          id: 'pwa-update',
          title: t('update.title'),
          description: t('update.body'),
          icon: 'i-lucide-refresh-cw',
          duration: 0,
          actions: [{ label: t('update.action'), onClick: () => void pwa.updateServiceWorker() }],
        })
      },
      { immediate: true },
    )
  })
})
