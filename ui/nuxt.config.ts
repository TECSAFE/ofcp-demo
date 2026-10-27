import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/i18n'],
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'de',
    // Messages are defined in i18n/i18n.config.ts (imported JSON) rather than
    // via file-based lazy locales: rolldown-vite's builtin JSON plugin and
    // @intlify/unplugin-vue-i18n both transform lazy locale files, producing a
    // JSON.parse() over precompiled JS. Importing the catalogs as messages
    // sidesteps that double-transform.
    bundle: {
      optimizeTranslationDirective: false,
    },
    locales: [
      { code: 'de', language: 'de-DE', name: 'Deutsch' },
      { code: 'en', language: 'en-US', name: 'English' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      // Override with NUXT_PUBLIC_API_BASE / NUXT_PUBLIC_WIDGET_BASE_URL / NUXT_PUBLIC_EDITOR_URL.
      apiBase: '/api',
      widgetBaseUrl: 'https://app-ui.tecsafe.de/iframe',
      // OFCP editor opened as the SDK fullscreen app from the footer; empty hides the button.
      editorUrl: 'https://ofcp-editor.staging.tecsafe.de',
    },
  },
})
