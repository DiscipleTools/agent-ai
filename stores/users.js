import { defineStore } from 'pinia'
import { sanitizeErrorMessage } from '~/utils/sanitize'

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
      users.value = Array.isArray(data) ? data : []
    } catch (err) {
      error.value = sanitizeErrorMessage(err)
      throw new Error(sanitizeErrorMessage(err))
    } finally {
      loading.value = false
    }
  }

  const fetchUser = async (id) => {
    if (!id) throw new Error('User ID is required')
    
    loading.value = true
    error.value = null
    try {
      const { data } = await $api(`/api/users/${id}`)
      currentUser.value = data
      return data
    } catch (err) {
      error.value = sanitizeErrorMessage(err)
      throw new Error(sanitizeErrorMessage(err))
    } finally {
      loading.value = false
    }
  }

  const inviteUser = async (userData) => {
    if (!userData || !userData.email) throw new Error('Valid user data with email is required')
    
    loading.value = true
    error.value = null
    try {
      const { data } = await $api('/api/users/invite', {
        method: 'POST',
        body: userData
      })
      if (data) {
        users.value.unshift(data)
      }
      return data
    } catch (err) {
      error.value = sanitizeErrorMessage(err)
      throw new Error(sanitizeErrorMessage(err))
    } finally {
      loading.value = false
    }
  }

  const updateUser = async (id, userData) => {
    if (!id) throw new Error('User ID is required')
    if (!userData) throw new Error('User data is required')
    
    loading.value = true
    error.value = null
    try {
      const { data } = await $api(`/api/users/${id}`, {
        method: 'PUT',
        body: userData
      })
      
      // Update in users list
      const index = users.value.findIndex(user => user._id === id)
      if (index !== -1 && data) {
        users.value[index] = data
      }
      
      // Update current user if it's the same
      if (currentUser.value?._id === id && data) {
        currentUser.value = data
      }
      
      return data
    } catch (err) {
      error.value = sanitizeErrorMessage(err)
      throw new Error(sanitizeErrorMessage(err))
    } finally {
      loading.value = false
    }
  }

  const deleteUser = async (id) => {
    if (!id) throw new Error('User ID is required')
    
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
      error.value = sanitizeErrorMessage(err)
      throw new Error(sanitizeErrorMessage(err))
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