// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/color-mode',
    '@vee-validate/nuxt'
  ],

  css: ['~/assets/css/main.css'],

  devServer: {
    port: 3000,
    host: 'localhost'
  },

  runtimeConfig: {
    // Private keys (only available on server-side)
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtExpire: process.env.JWT_EXPIRE || '1h',
    jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Public keys (exposed to client-side)
    public: {
      apiBase: '/api',
      appName: process.env.APP_NAME || 'Agent AI Server'
    }
  },

  app: {
    head: {
      title: 'Agent AI Server',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'AI Agent Management Dashboard' }
      ]
    }
  },

  ssr: false,

  nitro: {
    experimental: {
      wasm: true
    }
  }
})
