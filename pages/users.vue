<template>
  <div>
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
          Manage users and their permissions
        </p>
      </div>
      <div class="mt-4 sm:mt-0">
        <button
          @click="showInviteModal = true"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <UserPlusIcon class="w-4 h-4 mr-2" />
          Invite User
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="usersStore.loading && !usersStore.users.length" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="usersStore.error" class="text-center py-12">
      <div class="text-red-600 dark:text-red-400 mb-4">{{ usersStore.error }}</div>
      <button @click="fetchUsers" class="btn-primary">
        Try Again
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!usersStore.users.length" class="text-center py-12">
      <UsersIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Get started by inviting your first user.
      </p>
      <div class="mt-6">
        <button
          @click="showInviteModal = true"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <UserPlusIcon class="w-4 h-4 mr-2" />
          Invite User
        </button>
      </div>
    </div>

    <!-- Users Table -->
    <div v-else class="card p-0">
      <UserTable
        :users="usersStore.users"
        @edit="handleEditUser"
        @delete="handleDeleteUser"
        @toggle-status="handleToggleUserStatus"
      />
    </div>

    <!-- Invite Modal -->
    <InviteModal
      :is-open="showInviteModal"
      :available-agents="availableAgents"
      @close="showInviteModal = false"
      @submit="handleInviteUser"
    />

    <!-- Edit Modal -->
    <UserForm
      :is-open="showEditModal"
      :user="selectedUser"
      :available-agents="availableAgents"
      :current-user-id="authStore.user?._id"
      @close="closeEditModal"
      @submit="handleUpdateUser"
    />
  </div>
</template>

<script setup>
import { UserPlusIcon, UsersIcon } from '@heroicons/vue/24/outline'
import UserTable from '~/components/User/UserTable.vue'
import InviteModal from '~/components/User/InviteModal.vue'
import UserForm from '~/components/User/UserForm.vue'
import { useAgentsStore } from '~/stores/agents'
import { useToast } from 'vue-toastification'
import { sanitizeErrorMessage } from '~/utils/sanitize'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'admin']
})

const usersStore = useUsersStore()
const authStore = useAuthStore()
const agentsStore = useAgentsStore()
const toast = useToast()

const showInviteModal = ref(false)
const showEditModal = ref(false)
const selectedUser = ref(null)

// Get available agents for assignment
const availableAgents = computed(() => agentsStore.agents || [])

const fetchUsers = async () => {
  try {
    await usersStore.fetchUsers()
  } catch (error) {
    console.error('Failed to load users:', error)
  }
}

const fetchAgents = async () => {
  try {
    await agentsStore.fetchAgents()
  } catch (error) {
    console.error('Failed to load agents:', error)
  }
}

const handleInviteUser = async (userData) => {
  try {
    await usersStore.inviteUser(userData)
    showInviteModal.value = false
    
    toast('User invited successfully', { type: 'success' })
  } catch (error) {
    toast(sanitizeErrorMessage(error), { type: 'error' })
  }
}

const handleEditUser = (user) => {
  selectedUser.value = user
  showEditModal.value = true
}

const handleUpdateUser = async (userId, userData) => {
  try {
    await usersStore.updateUser(userId, userData)
    showEditModal.value = false
    selectedUser.value = null
    
    toast('User updated successfully', { type: 'success' })
  } catch (error) {
    toast(sanitizeErrorMessage(error), { type: 'error' })
  }
}

const handleDeleteUser = async (userId) => {
  const user = usersStore.users.find(u => u._id === userId)
  if (!user) return

  // Enhanced confirmation for user deletion
  const confirmMessage = `Are you sure you want to delete user "${user.name}"?\n\nThis action cannot be undone and will:\n- Remove all user data\n- Revoke all access permissions\n\nType "${user.email}" to confirm:`
  
  const userConfirmation = prompt(confirmMessage)
  if (userConfirmation !== user.email) {
    return
  }

  try {
    await usersStore.deleteUser(userId)
    
    toast('User deleted successfully', { type: 'success' })
  } catch (error) {
    toast(sanitizeErrorMessage(error), { type: 'error' })
  }
}

const handleToggleUserStatus = async (userId) => {
  const user = usersStore.users.find(u => u._id === userId)
  if (!user) return

  const action = user.isActive ? 'deactivate' : 'activate'
  const confirmMessage = `Are you sure you want to ${action} user "${user.name}"?`
  
  if (!confirm(confirmMessage)) {
    return
  }

  try {
    await usersStore.toggleUserStatus(userId)
    
    toast(`User ${action}d successfully`, { type: 'success' })
  } catch (error) {
    toast(sanitizeErrorMessage(error), { type: 'error' })
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  selectedUser.value = null
}

// Fetch data on mount
onMounted(async () => {
  await Promise.all([
    fetchUsers(),
    fetchAgents()
  ])
})
</script> 