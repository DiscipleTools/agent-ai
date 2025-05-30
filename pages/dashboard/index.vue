<template>
  <div class="space-y-8">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {{ authStore.user?.name }}! 👋
        </h1>
        <p class="mt-2 text-lg text-gray-600 dark:text-gray-300">
          Here's what's happening with your AI agents today.
        </p>
      </div>
      <div class="mt-4 sm:mt-0">
        <NuxtLink to="/dashboard/agents" class="btn-primary inline-flex items-center">
          <PlusIcon class="w-5 h-5 mr-2" />
          Create Agent
        </NuxtLink>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Total Agents Card -->
      <div class="stats-card group">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Agents</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-2">{{ stats.totalAgents }}</p>
            <p class="text-sm text-green-600 dark:text-green-400 mt-1">
              <span class="inline-flex items-center">
                <ArrowUpIcon class="w-4 h-4 mr-1" />
                +12% from last month
              </span>
            </p>
          </div>
          <div class="p-3 bg-blue-100 dark:bg-blue-900 rounded-full group-hover:scale-110 transition-transform">
            <CpuChipIcon class="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      <!-- Active Agents Card -->
      <div class="stats-card group">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Active Agents</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-2">{{ stats.activeAgents }}</p>
            <p class="text-sm text-green-600 dark:text-green-400 mt-1">
              <span class="inline-flex items-center">
                <CheckCircleIcon class="w-4 h-4 mr-1" />
                All systems operational
              </span>
            </p>
          </div>
          <div class="p-3 bg-green-100 dark:bg-green-900 rounded-full group-hover:scale-110 transition-transform">
            <CheckCircleIcon class="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      <!-- Messages Today Card -->
      <div class="stats-card group">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Messages Today</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-2">{{ stats.messagesToday }}</p>
            <p class="text-sm text-blue-600 dark:text-blue-400 mt-1">
              <span class="inline-flex items-center">
                <ClockIcon class="w-4 h-4 mr-1" />
                Last 24 hours
              </span>
            </p>
          </div>
          <div class="p-3 bg-purple-100 dark:bg-purple-900 rounded-full group-hover:scale-110 transition-transform">
            <ChatBubbleLeftRightIcon class="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>

      <!-- Response Time Card -->
      <div class="stats-card group">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Response Time</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-2">{{ stats.avgResponseTime }}s</p>
            <p class="text-sm text-green-600 dark:text-green-400 mt-1">
              <span class="inline-flex items-center">
                <ArrowDownIcon class="w-4 h-4 mr-1" />
                -15% faster
              </span>
            </p>
          </div>
          <div class="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full group-hover:scale-110 transition-transform">
            <BoltIcon class="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Quick Actions -->
      <div class="lg:col-span-1">
        <div class="card">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
            <div class="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <RocketLaunchIcon class="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          
          <div class="space-y-4">
            <NuxtLink
              to="/dashboard/agents"
              class="action-card group"
            >
              <div class="flex items-center">
                <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <PlusIcon class="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div class="ml-4">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">Create New Agent</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Set up a new AI assistant</p>
                </div>
              </div>
              <ChevronRightIcon class="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </NuxtLink>
            
            <NuxtLink
              to="/dashboard/agents"
              class="action-card group"
            >
              <div class="flex items-center">
                <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <CpuChipIcon class="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div class="ml-4">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">Manage Agents</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">View and edit existing agents</p>
                </div>
              </div>
              <ChevronRightIcon class="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </NuxtLink>
            
            <NuxtLink
              v-if="authStore.isAdmin"
              to="/dashboard/users"
              class="action-card group"
            >
              <div class="flex items-center">
                <div class="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <UsersIcon class="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div class="ml-4">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">Manage Users</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Invite and manage team members</p>
                </div>
              </div>
              <ChevronRightIcon class="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </NuxtLink>

            <NuxtLink
              to="/dashboard/settings"
              class="action-card group"
            >
              <div class="flex items-center">
                <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                  <CogIcon class="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div class="ml-4">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">Settings</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Configure your preferences</p>
                </div>
              </div>
              <ChevronRightIcon class="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Recent Activity & Agent Status -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Recent Activity -->
        <div class="card">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span class="text-sm text-gray-500 dark:text-gray-400">Live</span>
            </div>
          </div>
          
          <div class="space-y-4">
            <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
              <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                  <div :class="activity.iconBg" class="p-2 rounded-full">
                    <component :is="activity.icon" class="h-4 w-4" :class="activity.iconColor" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ activity.title }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ activity.description }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ activity.time }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- System Status -->
        <div class="card">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">System Status</h3>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <div class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
              All Systems Operational
            </span>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="status-item">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-900 dark:text-white">API Status</span>
                <span class="text-xs text-green-600 dark:text-green-400">Healthy</span>
              </div>
              <div class="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div class="bg-green-500 h-2 rounded-full" style="width: 100%"></div>
              </div>
            </div>
            
            <div class="status-item">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-900 dark:text-white">Database</span>
                <span class="text-xs text-green-600 dark:text-green-400">Connected</span>
              </div>
              <div class="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div class="bg-green-500 h-2 rounded-full" style="width: 98%"></div>
              </div>
            </div>
            
            <div class="status-item">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-900 dark:text-white">AI Service</span>
                <span class="text-xs text-yellow-600 dark:text-yellow-400">Configuring</span>
              </div>
              <div class="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div class="bg-yellow-500 h-2 rounded-full" style="width: 75%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Getting Started Section -->
    <div v-if="stats.totalAgents === 0" class="card text-center">
      <div class="max-w-md mx-auto">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-900 mb-4">
          <RocketLaunchIcon class="h-8 w-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Ready to get started?</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-6">
          Create your first AI agent to begin automating customer conversations and support.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <NuxtLink to="/dashboard/agents" class="btn-primary">
            <PlusIcon class="w-4 h-4 mr-2" />
            Create Your First Agent
          </NuxtLink>
          <NuxtLink to="/dashboard/settings" class="btn-secondary">
            <CogIcon class="w-4 h-4 mr-2" />
            Configure Settings
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  CpuChipIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  PlusIcon,
  UsersIcon,
  CogIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronRightIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  RocketLaunchIcon
} from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const authStore = useAuthStore()

// Mock data - replace with real data from API
const stats = reactive({
  totalAgents: 0,
  activeAgents: 0,
  messagesToday: 0,
  avgResponseTime: 2.3
})

const recentActivity = ref([
  {
    id: 1,
    title: 'System Initialized',
    description: 'Agent AI Server is ready for configuration',
    time: '2 minutes ago',
    icon: CheckCircleIcon,
    iconBg: 'bg-green-100 dark:bg-green-900',
    iconColor: 'text-green-600 dark:text-green-400'
  },
  {
    id: 2,
    title: 'Database Connected',
    description: 'Successfully connected to MongoDB',
    time: '5 minutes ago',
    icon: CpuChipIcon,
    iconBg: 'bg-blue-100 dark:bg-blue-900',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 3,
    title: 'User Authenticated',
    description: `${authStore.user?.name} logged in successfully`,
    time: '10 minutes ago',
    icon: UserIcon,
    iconBg: 'bg-purple-100 dark:bg-purple-900',
    iconColor: 'text-purple-600 dark:text-purple-400'
  }
])
</script> 