import { execFileSync } from 'node:child_process'

function buildCommit(): string {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const CLIENT_RENDERED = { ssr: false }

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  ssr: true,

  devServer: { host: '127.0.0.1' },

  modules: ['@nuxt/ui', '@vueuse/nuxt', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  ui: { fonts: false },

  icon: { clientBundle: { scan: { globInclude: ['app/**/*.{vue,ts}'] } } },

  routeRules: { '/app-shell': { ...CLIENT_RENDERED, prerender: true } },

  runtimeConfig: { public: { commit: buildCommit() } },

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
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'OpenDeck' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'OpenDeck' },
        { property: 'og:title', content: 'OpenDeck' },
        {
          property: 'og:description',
          content: 'Learn languages with spaced-repetition flashcards you own.',
        },
        { property: 'og:image', content: 'https://opendeck.space/og.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'OpenDeck: Learn languages with flashcards you keep.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: 'https://opendeck.space/og.png' },
      ],
      link: [{ rel: 'apple-touch-icon', href: '/pwa-192x192.png' }],
    },
  },

  future: { compatibilityVersion: 4 },

  pwa: {
    registerType: 'prompt',
    client: { registerPlugin: true, installPrompt: 'opendeck-pwa-install-hidden', periodicSyncForUpdates: 0 },
    manifest: {
      id: '/',
      name: 'OpenDeck',
      short_name: 'OpenDeck',
      description: 'Spaced-repetition language flashcards on ATproto.',
      theme_color: '#000000',
      background_color: '#000000',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      categories: ['education', 'productivity'],
      icons: [
        { src: '/opendeck.svg', sizes: 'any', type: 'image/svg+xml' },
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/pwa-monochrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
      ],
    },
    workbox: {
      navigateFallback: '/app-shell',
      navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\//, /^\/oauth-client-metadata\.json$/],
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /\/api\/_nuxt_icon\//,
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'opendeck-icons', expiration: { maxEntries: 100 } },
        },
        {
          urlPattern: /^https:\/\/cdn\.bsky\.app\/img\/avatar/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'opendeck-avatars',
            expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
      clientsClaim: true,
      importScripts: ['/sw-push.js'],
      sourcemap: false,
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },
})
