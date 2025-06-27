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

  vite: {
    server: {
      strictPort: true
    }
  },

  runtimeConfig: {
    // Private keys (only available on server-side)
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    csrfSecret: process.env.CSRF_SECRET,
    jwtExpire: process.env.JWT_EXPIRE || '24h',
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
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192x192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/favicon-512x512.png' },
        { rel: 'manifest', href: '/site.webmanifest' }
      ]
    }
  },

  ssr: false,

  nitro: {
    experimental: {
      wasm: true
    },
    routeRules: {
      '/**': {
        headers: {
          // Content Security Policy
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline for development, remove in production
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self'",
            "font-src 'self'",
            "object-src 'none'",
            "media-src 'self'",
            "frame-src 'none'",
            "worker-src 'self'",
            "manifest-src 'self'"
          ].join('; '),
          
          // Additional Security Headers
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
          
          // HSTS (only in production with HTTPS)
          ...(process.env.NODE_ENV === 'production' ? {
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
          } : {}),
          
          // Prevent caching of sensitive pages  
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },
      // More permissive for API endpoints that need to handle file uploads
      '/api/agents/*/context/upload': {
        headers: {
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self'",
            "img-src 'self'",
            "connect-src 'self'",
            "object-src 'none'"
          ].join('; ')
        }
      },
      // Allow static assets caching
      '/_nuxt/**': {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      }
    }
  }
})
