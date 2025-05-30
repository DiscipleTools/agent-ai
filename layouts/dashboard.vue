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
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <span class="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {{ authStore.user?.name?.charAt(0).toUpperCase() }}
                </span>
              </div>
            </div>
            <div class="ml-3 flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ authStore.user?.name }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ authStore.user?.email }}
              </p>
            </div>
            <button
              @click="authStore.logout"
              class="ml-2 flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 rounded-md transition-colors"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon class="w-4 h-4 mr-1" />
              Logout
            </button>
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
          
          <!-- User Profile -->
          <div class="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                  <span class="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {{ authStore.user?.name?.charAt(0).toUpperCase() }}
                  </span>
                </div>
              </div>
              <div class="ml-3 flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ authStore.user?.name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ authStore.user?.role === 'admin' ? 'Administrator' : 'User' }}
                </p>
              </div>
              <div class="ml-2 flex space-x-1">
                <button
                  @click="toggleDarkMode"
                  class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Toggle theme"
                >
                  <SunIcon v-if="$colorMode.value === 'dark'" class="w-4 h-4" />
                  <MoonIcon v-else class="w-4 h-4" />
                </button>
                <button
                  @click="authStore.logout"
                  class="ml-2 flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 rounded-md transition-colors"
                  title="Logout"
                >
                  <ArrowRightOnRectangleIcon class="w-4 h-4 mr-1" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 flex flex-col min-w-0 md:ml-64">
        <!-- Top header -->
        <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
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
                        <span class="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">Dashboard</span>
                      </div>
                    </li>
                    <li v-if="currentPageName !== 'Dashboard'">
                      <div class="flex items-center">
                        <ChevronRightIcon class="w-4 h-4 text-gray-400 mx-2" />
                        <span class="text-sm font-medium text-gray-900 dark:text-white">{{ currentPageName }}</span>
                      </div>
                    </li>
                  </ol>
                </nav>
              </div>
              
              <div class="flex items-center space-x-4">
                <!-- Notifications -->
                <button class="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors relative">
                  <BellIcon class="w-5 h-5" />
                  <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                
                <!-- Logout button (desktop) -->
                <button
                  @click="authStore.logout"
                  class="hidden md:flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  title="Logout"
                >
                  <ArrowRightOnRectangleIcon class="w-4 h-4 mr-2" />
                  Logout
                </button>
                
                <!-- Theme toggle (mobile) -->
                <button
                  @click="toggleDarkMode"
                  class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <SunIcon v-if="$colorMode.value === 'dark'" class="w-5 h-5" />
                  <MoonIcon v-else class="w-5 h-5" />
                </button>
                
                <!-- Logout button (mobile) -->
                <button
                  @click="authStore.logout"
                  class="md:hidden p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  title="Logout"
                >
                  <ArrowRightOnRectangleIcon class="w-5 h-5" />
                </button>
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
  UsersIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()
const colorMode = useColorMode()
const route = useRoute()

const mobileMenuOpen = ref(false)

const navigation = computed(() => [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Agents', href: '/dashboard/agents', icon: CpuChipIcon, badge: '0' },
  ...(authStore.isAdmin ? [{ name: 'Users', href: '/dashboard/users', icon: UsersIcon }] : []),
  { name: 'Settings', href: '/dashboard/settings', icon: CogIcon }
])

const currentPageName = computed(() => {
  const path = route.path
  if (path === '/dashboard') return 'Dashboard'
  if (path.includes('/agents')) return 'Agents'
  if (path.includes('/users')) return 'Users'
  if (path.includes('/settings')) return 'Settings'
  return 'Dashboard'
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