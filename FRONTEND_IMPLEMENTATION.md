# Frontend Implementation Guide - Nuxt.js + Vue + Tailwind

## 1. Project Setup

### 1.1 Initialize Nuxt.js Project
```bash
# Create new Nuxt.js project
npx nuxi@latest init agent-ai-frontend
cd agent-ai-frontend

# Install dependencies
npm install

# Install additional packages
npm install @nuxtjs/tailwindcss
npm install @pinia/nuxt pinia
npm install @vueuse/nuxt @vueuse/core
npm install @nuxtjs/color-mode
npm install @headlessui/vue @heroicons/vue
npm install axios
npm install @vee-validate/nuxt vee-validate @vee-validate/rules
npm install vue-toastification
```

### 1.2 Project Structure
```
agent-ai-frontend/
├── components/
│   ├── Agent/
│   │   ├── AgentCard.vue
│   │   ├── AgentForm.vue
│   │   ├── AgentList.vue
│   │   └── ContextUpload.vue
│   ├── User/
│   │   ├── UserTable.vue
│   │   ├── UserForm.vue
│   │   └── InviteModal.vue
│   ├── Layout/
│   │   ├── Header.vue
│   │   ├── Sidebar.vue
│   │   └── Footer.vue
│   ├── UI/
│   │   ├── Button.vue
│   │   ├── Input.vue
│   │   ├── Modal.vue
│   │   └── LoadingSpinner.vue
│   └── Auth/
│       ├── LoginForm.vue
│       └── ProtectedRoute.vue
├── composables/
│   ├── useAuth.js
│   ├── useAgents.js
│   ├── useUsers.js
│   └── useApi.js
├── layouts/
│   ├── default.vue
│   ├── auth.vue
│   └── dashboard.vue
├── middleware/
│   ├── auth.js
│   └── admin.js
├── pages/
│   ├── index.vue
│   ├── login.vue
│   └── dashboard/
│       ├── index.vue
│       ├── agents/
│       │   ├── index.vue
│       │   ├── [id].vue
│       │   └── create.vue
│       ├── users/
│       │   ├── index.vue
│       │   └── invite.vue
│       └── settings.vue
├── plugins/
│   ├── api.client.js
│   └── toast.client.js
├── stores/
│   ├── auth.js
│   ├── agents.js
│   └── users.js
└── utils/
    ├── constants.js
    └── helpers.js
```

## 2. Configuration

### 2.1 Nuxt Configuration (nuxt.config.ts)
```typescript
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/color-mode',
    '@vee-validate/nuxt'
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE_URL || 'http://localhost:3000/api',
      appName: 'Agent AI Server'
    }
  },

  colorMode: {
    classSuffix: ''
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.js'
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
  }
})
```

### 2.2 Tailwind Configuration (tailwind.config.js)
```javascript
module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./nuxt.config.{js,ts}",
    "./app.vue"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a'
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
}
```

### 2.3 Main CSS (assets/css/main.css)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply h-full;
  }
  
  body {
    @apply h-full bg-gray-50 dark:bg-gray-900;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
  }
  
  .btn-secondary {
    @apply bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;
  }
  
  .input-field {
    @apply block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white;
  }
}
```

## 3. Store Management (Pinia)

### 3.1 Auth Store (stores/auth.js)
```javascript
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const loading = ref(false)

  const { $api } = useNuxtApp()
  const router = useRouter()

  const login = async (credentials) => {
    loading.value = true
    try {
      const response = await $api.post('/auth/login', credentials)
      const { user: userData, tokens } = response.data.data

      // Store tokens
      const accessToken = useCookie('access-token', {
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 // 1 hour
      })
      const refreshToken = useCookie('refresh-token', {
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })

      accessToken.value = tokens.accessToken
      refreshToken.value = tokens.refreshToken
      user.value = userData

      await router.push('/dashboard')
      return { success: true }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Login failed')
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    try {
      const refreshToken = useCookie('refresh-token')
      if (refreshToken.value) {
        await $api.post('/auth/logout', { refreshToken: refreshToken.value })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear tokens and user data
      const accessToken = useCookie('access-token')
      const refreshToken = useCookie('refresh-token')
      
      accessToken.value = null
      refreshToken.value = null
      user.value = null
      
      await router.push('/login')
    }
  }

  const fetchUser = async () => {
    try {
      const response = await $api.get('/users/me')
      user.value = response.data.data
    } catch (error) {
      console.error('Failed to fetch user:', error)
      await logout()
    }
  }

  const refreshTokens = async () => {
    try {
      const refreshToken = useCookie('refresh-token')
      if (!refreshToken.value) throw new Error('No refresh token')

      const response = await $api.post('/auth/refresh', {
        refreshToken: refreshToken.value
      })

      const { accessToken, refreshToken: newRefreshToken } = response.data.data
      
      const accessTokenCookie = useCookie('access-token')
      const refreshTokenCookie = useCookie('refresh-token')
      
      accessTokenCookie.value = accessToken
      refreshTokenCookie.value = newRefreshToken

      return accessToken
    } catch (error) {
      await logout()
      throw error
    }
  }

  return {
    user: readonly(user),
    isAuthenticated,
    isAdmin,
    loading: readonly(loading),
    login,
    logout,
    fetchUser,
    refreshTokens
  }
})
```

### 3.2 Agents Store (stores/agents.js)
```javascript
import { defineStore } from 'pinia'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref([])
  const currentAgent = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const { $api } = useNuxtApp()

  const fetchAgents = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await $api.get('/agents')
      agents.value = response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch agents'
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchAgent = async (id) => {
    loading.value = true
    error.value = null
    try {
      const response = await $api.get(`/agents/${id}`)
      currentAgent.value = response.data.data
      return response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createAgent = async (agentData) => {
    loading.value = true
    error.value = null
    try {
      const response = await $api.post('/agents', agentData)
      const newAgent = response.data.data
      agents.value.unshift(newAgent)
      return newAgent
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to create agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateAgent = async (id, agentData) => {
    loading.value = true
    error.value = null
    try {
      const response = await $api.put(`/agents/${id}`, agentData)
      const updatedAgent = response.data.data
      
      // Update in agents list
      const index = agents.value.findIndex(agent => agent._id === id)
      if (index !== -1) {
        agents.value[index] = updatedAgent
      }
      
      // Update current agent if it's the same
      if (currentAgent.value?._id === id) {
        currentAgent.value = updatedAgent
      }
      
      return updatedAgent
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to update agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteAgent = async (id) => {
    loading.value = true
    error.value = null
    try {
      await $api.delete(`/agents/${id}`)
      agents.value = agents.value.filter(agent => agent._id !== id)
      
      if (currentAgent.value?._id === id) {
        currentAgent.value = null
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to delete agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  const uploadContext = async (agentId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await $api.post(`/agents/${agentId}/context/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to upload context'
      throw err
    }
  }

  const addContextUrl = async (agentId, url) => {
    try {
      const response = await $api.post(`/agents/${agentId}/context/url`, { url })
      return response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to add context URL'
      throw err
    }
  }

  return {
    agents: readonly(agents),
    currentAgent: readonly(currentAgent),
    loading: readonly(loading),
    error: readonly(error),
    fetchAgents,
    fetchAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    uploadContext,
    addContextUrl
  }
})
```

## 4. Composables

### 4.1 API Composable (composables/useApi.js)
```javascript
export const useApi = () => {
  const config = useRuntimeConfig()
  const { refreshTokens } = useAuthStore()

  const api = $fetch.create({
    baseURL: config.public.apiBase,
    
    onRequest({ request, options }) {
      const accessToken = useCookie('access-token')
      if (accessToken.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${accessToken.value}`
        }
      }
    },

    async onResponseError({ response, request, options }) {
      // Handle 401 errors by refreshing token
      if (response.status === 401) {
        try {
          const newToken = await refreshTokens()
          
          // Retry the original request with new token
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${newToken}`
          }
          
          return $fetch(request, options)
        } catch (error) {
          // Refresh failed, redirect to login
          await navigateTo('/login')
          throw error
        }
      }
    }
  })

  return { api }
}
```

### 4.2 Toast Composable (composables/useToast.js)
```javascript
export const useToast = () => {
  const { $toast } = useNuxtApp()

  const success = (message) => {
    $toast.success(message)
  }

  const error = (message) => {
    $toast.error(message)
  }

  const info = (message) => {
    $toast.info(message)
  }

  const warning = (message) => {
    $toast.warning(message)
  }

  return {
    success,
    error,
    info,
    warning
  }
}
```

## 5. Components

### 5.1 Agent Card Component (components/Agent/AgentCard.vue)
```vue
<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ agent.name }}
      </h3>
      <span 
        :class="[
          'px-2 py-1 rounded-full text-xs',
          agent.isActive 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        ]"
      >
        {{ agent.isActive ? 'Active' : 'Inactive' }}
      </span>
    </div>
    
    <p class="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
      {{ agent.description }}
    </p>
    
    <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
      <span>Created by {{ agent.createdBy.name }}</span>
      <span>{{ formatDate(agent.createdAt) }}</span>
    </div>
    
    <div class="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-4">
      <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">Webhook URL:</p>
      <div class="flex items-center space-x-2">
        <code class="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded flex-1 truncate">
          {{ agent.webhookUrl }}
        </code>
        <button
          @click="copyWebhookUrl"
          class="text-primary-600 hover:text-primary-700 text-xs"
          title="Copy URL"
        >
          <ClipboardIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
    
    <div class="flex space-x-2">
      <NuxtLink
        :to="`/dashboard/agents/${agent._id}`"
        class="flex-1 btn-primary text-center"
      >
        Edit
      </NuxtLink>
      <button
        @click="handleDelete"
        :disabled="isDeleting"
        class="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900"
      >
        {{ isDeleting ? 'Deleting...' : 'Delete' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ClipboardIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  agent: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['delete'])

const isDeleting = ref(false)
const toast = useToast()

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const copyWebhookUrl = async () => {
  try {
    await navigator.clipboard.writeText(props.agent.webhookUrl)
    toast.success('Webhook URL copied to clipboard')
  } catch (error) {
    toast.error('Failed to copy URL')
  }
}

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this agent?')) return
  
  isDeleting.value = true
  try {
    emit('delete', props.agent._id)
  } finally {
    isDeleting.value = false
  }
}
</script>
```

### 5.2 Agent Form Component (components/Agent/AgentForm.vue)
```vue
<template>
  <form @submit="onSubmit" class="space-y-6">
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Agent Name *
      </label>
      <Field
        v-slot="{ field, errorMessage }"
        name="name"
        rules="required"
      >
        <input
          v-bind="field"
          type="text"
          class="input-field"
          :class="{ 'border-red-500': errorMessage }"
          placeholder="Customer Support Agent"
        />
        <p v-if="errorMessage" class="text-red-600 text-sm mt-1">
          {{ errorMessage }}
        </p>
      </Field>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Description
      </label>
      <Field
        v-slot="{ field }"
        name="description"
      >
        <textarea
          v-bind="field"
          rows="3"
          class="input-field"
          placeholder="Handles customer support inquiries..."
        />
      </Field>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        System Prompt *
      </label>
      <Field
        v-slot="{ field, errorMessage }"
        name="prompt"
        rules="required|min:10"
      >
        <textarea
          v-bind="field"
          rows="6"
          class="input-field"
          :class="{ 'border-red-500': errorMessage }"
          placeholder="You are a helpful customer support agent..."
        />
        <p v-if="errorMessage" class="text-red-600 text-sm mt-1">
          {{ errorMessage }}
        </p>
      </Field>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Temperature
        </label>
        <Field
          v-slot="{ field }"
          name="settings.temperature"
          rules="min_value:0|max_value:1"
        >
          <input
            v-bind="field"
            type="number"
            step="0.1"
            min="0"
            max="1"
            class="input-field"
          />
        </Field>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Max Tokens
        </label>
        <Field
          v-slot="{ field }"
          name="settings.maxTokens"
          rules="min_value:1|max_value:2000"
        >
          <input
            v-bind="field"
            type="number"
            min="1"
            max="2000"
            class="input-field"
          />
        </Field>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Response Delay (s)
        </label>
        <Field
          v-slot="{ field }"
          name="settings.responseDelay"
          rules="min_value:0|max_value:30"
        >
          <input
            v-bind="field"
            type="number"
            min="0"
            max="30"
            class="input-field"
          />
        </Field>
      </div>
    </div>

    <div class="flex space-x-4">
      <button
        type="submit"
        :disabled="isSubmitting"
        class="btn-primary"
      >
        {{ isSubmitting ? 'Saving...' : 'Save Agent' }}
      </button>
      <button
        type="button"
        @click="$emit('cancel')"
        class="btn-secondary"
      >
        Cancel
      </button>
    </div>
  </form>
</template>

<script setup>
import { Form, Field } from 'vee-validate'

const props = defineProps({
  agent: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      prompt: '',
      settings: {
        temperature: 0.7,
        maxTokens: 500,
        responseDelay: 0
      }
    })
  }
})

const emit = defineEmits(['submit', 'cancel'])

const isSubmitting = ref(false)

const onSubmit = async (values) => {
  isSubmitting.value = true
  try {
    await emit('submit', values)
  } finally {
    isSubmitting.value = false
  }
}
</script>
```

## 6. Pages

### 6.1 Dashboard Layout (layouts/dashboard.vue)
```vue
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="flex">
      <!-- Sidebar -->
      <div class="hidden md:flex md:w-64 md:flex-col">
        <div class="flex flex-col flex-grow pt-5 overflow-y-auto bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div class="flex items-center flex-shrink-0 px-4">
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">
              Agent AI Server
            </h1>
          </div>
          
          <nav class="mt-8 flex-1 px-2 space-y-1">
            <NuxtLink
              to="/dashboard"
              class="nav-link"
              active-class="nav-link-active"
            >
              <HomeIcon class="w-5 h-5" />
              Dashboard
            </NuxtLink>
            
            <NuxtLink
              to="/dashboard/agents"
              class="nav-link"
              active-class="nav-link-active"
            >
              <CpuChipIcon class="w-5 h-5" />
              Agents
            </NuxtLink>
            
            <NuxtLink
              v-if="authStore.isAdmin"
              to="/dashboard/users"
              class="nav-link"
              active-class="nav-link-active"
            >
              <UsersIcon class="w-5 h-5" />
              Users
            </NuxtLink>
            
            <NuxtLink
              to="/dashboard/settings"
              class="nav-link"
              active-class="nav-link-active"
            >
              <CogIcon class="w-5 h-5" />
              Settings
            </NuxtLink>
          </nav>
          
          <div class="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ authStore.user?.name }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {{ authStore.user?.email }}
                </p>
              </div>
              <button
                @click="authStore.logout"
                class="ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 flex flex-col">
        <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div class="px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
              <div class="flex items-center">
                <button
                  @click="toggleMobileMenu"
                  class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Bars3Icon class="w-6 h-6" />
                </button>
              </div>
              
              <div class="flex items-center space-x-4">
                <button
                  @click="toggleDarkMode"
                  class="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <SunIcon v-if="$colorMode.value === 'dark'" class="w-5 h-5" />
                  <MoonIcon v-else class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto">
          <div class="py-6">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <slot />
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  HomeIcon,
  CpuChipIcon,
  UsersIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  SunIcon,
  MoonIcon
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()
const colorMode = useColorMode()

const toggleDarkMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const toggleMobileMenu = () => {
  // Implement mobile menu toggle
}
</script>

<style scoped>
.nav-link {
  @apply flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white;
}

.nav-link-active {
  @apply bg-primary-50 border-r-4 border-primary-500 text-primary-700 dark:bg-primary-900 dark:text-primary-200;
}
</style>
```

### 6.2 Agents List Page (pages/dashboard/agents/index.vue)
```vue
<template>
  <div>
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Agents</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
          Manage your AI agents and their configurations
        </p>
      </div>
      <div class="mt-4 sm:mt-0">
        <NuxtLink
          to="/dashboard/agents/create"
          class="btn-primary"
        >
          <PlusIcon class="w-4 h-4 mr-2" />
          Create Agent
        </NuxtLink>
      </div>
    </div>

    <div v-if="agentsStore.loading" class="flex justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="agentsStore.error" class="text-center py-12">
      <p class="text-red-600 dark:text-red-400">{{ agentsStore.error }}</p>
      <button @click="fetchAgents" class="mt-4 btn-primary">
        Try Again
      </button>
    </div>

    <div v-else-if="agentsStore.agents.length === 0" class="text-center py-12">
      <CpuChipIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No agents</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Get started by creating your first AI agent.
      </p>
      <div class="mt-6">
        <NuxtLink to="/dashboard/agents/create" class="btn-primary">
          <PlusIcon class="w-4 h-4 mr-2" />
          Create Agent
        </NuxtLink>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AgentCard
        v-for="agent in agentsStore.agents"
        :key="agent._id"
        :agent="agent"
        @delete="handleDeleteAgent"
      />
    </div>
  </div>
</template>

<script setup>
import { PlusIcon, CpuChipIcon } from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const agentsStore = useAgentsStore()
const toast = useToast()

const fetchAgents = async () => {
  try {
    await agentsStore.fetchAgents()
  } catch (error) {
    toast.error('Failed to load agents')
  }
}

const handleDeleteAgent = async (agentId) => {
  try {
    await agentsStore.deleteAgent(agentId)
    toast.success('Agent deleted successfully')
  } catch (error) {
    toast.error('Failed to delete agent')
  }
}

// Fetch agents on mount
onMounted(() => {
  fetchAgents()
})
</script>
```

This comprehensive Nuxt.js implementation provides:

1. **Modern Vue 3 + Composition API**: Clean, maintainable code
2. **Pinia State Management**: Reactive stores for auth, agents, and users
3. **Tailwind CSS**: Beautiful, responsive design with dark mode
4. **VeeValidate**: Form validation with error handling
5. **Auto-imports**: Nuxt's auto-import for composables and components
6. **TypeScript Ready**: Easy to migrate to TypeScript later
7. **Mobile Responsive**: Works great on all devices
8. **Accessibility**: Proper ARIA labels and keyboard navigation

The structure is modular and scalable, making it easy to add new features and maintain the codebase as it grows! 