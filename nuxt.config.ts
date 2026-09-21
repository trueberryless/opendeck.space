export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  ssr: true,

  devServer: { host: '127.0.0.1' },

  modules: ['@nuxt/ui', '@vueuse/nuxt', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    storageKey: 'opendeck-color-mode',
  },

  app: {
    head: {
      title: 'OpenDeck',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          name: 'description',
          content: 'Learn languages with spaced-repetition flashcards you own.',
        },
        { name: 'theme-color', content: '#000000' },
      ],
    },
  },

  future: { compatibilityVersion: 4 },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'OpenDeck',
      short_name: 'OpenDeck',
      description: 'Spaced-repetition language flashcards on ATproto.',
      theme_color: '#000000',
      background_color: '#000000',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/opendeck.svg', sizes: 'any', type: 'image/svg+xml' },
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },
})
