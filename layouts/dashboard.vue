<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Mobile menu overlay -->
    <div v-if="mobileMenuOpen" class="fixed inset-0 z-40 md:hidden">
      <div class="fixed inset-0 bg-gray-600 bg-opacity-75" @click="closeMobileMenu"></div>
    </div>

    <!-- Mobile sidebar -->
    <div 
      :class="[
        'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out md:hidden',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <div class="flex flex-col h-full">
        <div class="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">
            Agent AI
          </h1>
          <button
            @click="closeMobileMenu"
            class="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>
        
        <nav class="flex-1 px-4 py-6 space-y-2">
          <NuxtLink
            v-for="item in navigation"
            :key="item.name"
            :to="item.href"
            @click="closeMobileMenu"
            class="nav-link"
            active-class="nav-link-active"
          >
            <component :is="item.icon" class="w-5 h-5 mr-3" />
            {{ item.name }}
          </NuxtLink>
        </nav>
        
        <div class="p-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center">
            <div class="flex items-center flex-1 min-w-0 p-2">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                  <span class="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {{ sanitizedUser?.initial }}
                  </span>
                </div>
              </div>
              <div class="ml-3 flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ sanitizedUser?.name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ sanitizedUser?.email }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex h-screen">
      <!-- Desktop Sidebar -->
      <div class="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div class="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <!-- Logo -->
          <div class="flex items-center h-16 px-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <CpuChipIcon class="w-5 h-5 text-white" />
              </div>
              <h1 class="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                Agent AI
              </h1>
            </div>
          </div>
          
          <!-- Navigation -->
          <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <NuxtLink
              v-for="item in navigation"
              :key="item.name"
              :to="item.href"
              class="nav-link group"
              active-class="nav-link-active"
            >
              <component :is="item.icon" class="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
              {{ item.name }}
              <span v-if="item.badge" class="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                {{ item.badge }}
              </span>
            </NuxtLink>
          </nav>
          
          <!-- User Info -->
          <div class="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center">
              <div class="flex items-center flex-1 min-w-0 p-2">
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                    <span class="text-sm font-medium text-primary-600 dark:text-primary-400">
                      {{ sanitizedUser?.initial }}
                    </span>
                  </div>
                </div>
                <div class="ml-3 flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ sanitizedUser?.name }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {{ sanitizedUser?.role === 'admin' ? 'Administrator' : 'User' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 flex flex-col min-w-0 md:ml-64">
        <!-- Top header -->
        <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <!-- Main Header Content -->
          <div class="px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
              <div class="flex items-center">
                <button
                  @click="openMobileMenu"
                  class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Bars3Icon class="w-6 h-6" />
                </button>
                
                <!-- Breadcrumb -->
                <nav class="hidden md:flex ml-4" aria-label="Breadcrumb">
                  <ol class="flex items-center space-x-2">
                    <li>
                      <div class="flex items-center">
                        <HomeIcon class="w-4 h-4 text-gray-400" />
                        <span class="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">Inboxes</span>
                      </div>
                    </li>
                    <li v-if="currentPageName !== 'Inboxes'">
                      <div class="flex items-center">
                        <ChevronRightIcon class="w-4 h-4 text-gray-400 mx-2" />
                        <span class="text-sm font-medium text-gray-900 dark:text-white">{{ currentPageName }}</span>
                      </div>
                    </li>
                  </ol>
                </nav>
              </div>
              
              <div class="flex items-center space-x-4">
                <!-- Chatwoot button (desktop) -->
                <a
                  href="/"
                  rel="noopener noreferrer"
                  class="hidden md:flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-md transition-colors"
                  title="Open Chatwoot"
                >
                  <ChatBubbleLeftRightIcon class="w-4 h-4 mr-2" />
                  Chatwoot
                </a>
                
                <!-- Chatwoot button (mobile) -->
                <a
                  href="/"
                  rel="noopener noreferrer"
                  class="md:hidden p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-md transition-colors"
                  title="Open Chatwoot"
                >
                  <ChatBubbleLeftRightIcon class="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </header>

        <!-- Page content -->
        <main class="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  HomeIcon,
  CpuChipIcon,
  CogIcon,
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  ChevronRightIcon,
  ChatBubbleLeftRightIcon,
  InboxIcon,
  RocketLaunchIcon
} from '@heroicons/vue/24/outline'
import { sanitizeText, sanitizeEmail } from '~/utils/sanitize.js'

const authStore = useAuthStore()
const colorMode = useColorMode()
const route = useRoute()

const mobileMenuOpen = ref(false)

// Sanitized user data for secure display
const sanitizedUser = computed(() => {
  const user = authStore.user
  if (!user) return null
  
  return {
    name: sanitizeText(user.name || ''),
    email: sanitizeEmail(user.email || ''),
    role: sanitizeText(user.role || ''),
    initial: sanitizeText(user.name || '').charAt(0).toUpperCase() || '?'
  }
})

const navigation = computed(() => [
  { name: 'Inboxes', href: '/inboxes', icon: InboxIcon },
  { name: 'Agents', href: '/agents', icon: RocketLaunchIcon },
  { name: 'Chatwoot Profile', href: '/chatwoot-profile', icon: ChatBubbleLeftRightIcon },
  ...(authStore.isSuperAdmin ? [{ name: 'Settings', href: '/settings', icon: CogIcon }] : [])
])

const currentPageName = computed(() => {
  const path = route.path
  if (path.includes('/inboxes')) return 'Inboxes'
  if (path.includes('/agents')) return 'Agents'
  if (path.includes('/chatwoot-profile')) return 'Chatwoot Profile'
  if (path.includes('/settings')) return 'Settings'
  return 'Inboxes'
})



const toggleDarkMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const openMobileMenu = () => {
  mobileMenuOpen.value = true
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

// Close mobile menu when route changes
watch(() => route.path, () => {
  mobileMenuOpen.value = false
})


</script> 