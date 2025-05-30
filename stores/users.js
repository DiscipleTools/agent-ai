import { defineStore } from 'pinia'

export const useUsersStore = defineStore('users', () => {
  const users = ref([])
  const currentUser = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const { $api } = useApi()

  const fetchUsers = async () => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api('/api/users')
      users.value = data
    } catch (err) {
      error.value = err.data?.message || 'Failed to fetch users'
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchUser = async (id) => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api(`/api/users/${id}`)
      currentUser.value = data
      return data
    } catch (err) {
      error.value = err.data?.message || 'Failed to fetch user'
      throw err
    } finally {
      loading.value = false
    }
  }

  const inviteUser = async (userData) => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api('/api/users/invite', {
        method: 'POST',
        body: userData
      })
      users.value.unshift(data)
      return data
    } catch (err) {
      error.value = err.data?.message || 'Failed to invite user'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateUser = async (id, userData) => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api(`/api/users/${id}`, {
        method: 'PUT',
        body: userData
      })
      
      // Update in users list
      const index = users.value.findIndex(user => user._id === id)
      if (index !== -1) {
        users.value[index] = data
      }
      
      // Update current user if it's the same
      if (currentUser.value?._id === id) {
        currentUser.value = data
      }
      
      return data
    } catch (err) {
      error.value = err.data?.message || 'Failed to update user'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteUser = async (id) => {
    loading.value = true
    error.value = null
    try {
      await $api(`/api/users/${id}`, {
        method: 'DELETE'
      })
      users.value = users.value.filter(user => user._id !== id)
      
      if (currentUser.value?._id === id) {
        currentUser.value = null
      }
    } catch (err) {
      error.value = err.data?.message || 'Failed to delete user'
      throw err
    } finally {
      loading.value = false
    }
  }

  const toggleUserStatus = async (id) => {
    const user = users.value.find(u => u._id === id)
    if (!user) return

    try {
      await updateUser(id, { isActive: !user.isActive })
    } catch (err) {
      throw err
    }
  }

  return {
    users: readonly(users),
    currentUser: readonly(currentUser),
    loading: readonly(loading),
    error: readonly(error),
    fetchUsers,
    fetchUser,
    inviteUser,
    updateUser,
    deleteUser,
    toggleUserStatus
  }
}) 