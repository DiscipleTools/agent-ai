import { describe, it, expect } from 'vitest'
import { $fetch } from 'ofetch'
import { testUsers, getAuthHeaders } from '../setup'

const BASE_URL = 'http://localhost:3000'

describe('Users API', () => {
  describe('GET /api/users', () => {
    it('should allow admin to fetch all users', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/users`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBeGreaterThan(0)
    })

    it('should reject regular user access', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/users`, {
          headers
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated access', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/users`)
      ).rejects.toThrow()
    })

    it('should reject inactive user access', async () => {
      const headers = getAuthHeaders('inactive')
      
      await expect(
        $fetch(`${BASE_URL}/api/users`, {
          headers
        })
      ).rejects.toThrow()
    })
  })

  describe('POST /api/users/invite', () => {
    it('should allow admin to invite new users', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/users/invite`, {
        method: 'POST',
        headers,
        body: {
          email: 'newuser@test.com',
          name: 'New User',
          role: 'user'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('email')
      expect(response.data.email).toBe('newuser@test.com')
    })

    it('should reject regular user invitation attempts', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/users/invite`, {
          method: 'POST',
          headers,
          body: {
            email: 'newuser@test.com',
            name: 'New User',
            role: 'user'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated invitation attempts', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/users/invite`, {
          method: 'POST',
          body: {
            email: 'newuser@test.com',
            name: 'New User',
            role: 'user'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('PUT /api/users/[id]', () => {
    it('should allow admin to update any user', async () => {
      const headers = getAuthHeaders('admin')
      const userId = testUsers.user._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers,
        body: {
          name: 'Updated User Name'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('Updated User Name')
    })

    it('should reject regular user updating other users', async () => {
      const headers = getAuthHeaders('user')
      const adminId = testUsers.admin._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/users/${adminId}`, {
          method: 'PUT',
          headers,
          body: {
            name: 'Hacked Admin'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated user updates', async () => {
      const userId = testUsers.user._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/users/${userId}`, {
          method: 'PUT',
          body: {
            name: 'Hacked User'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('DELETE /api/users/[id]', () => {
    it('should allow admin to delete users', async () => {
      const headers = getAuthHeaders('admin')
      const userId = testUsers.user._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers
      })

      expect(response.success).toBe(true)
    })

    it('should reject regular user deletion attempts', async () => {
      const headers = getAuthHeaders('user')
      const adminId = testUsers.admin._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/users/${adminId}`, {
          method: 'DELETE',
          headers
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated deletion attempts', async () => {
      const userId = testUsers.user._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/users/${userId}`, {
          method: 'DELETE'
        })
      ).rejects.toThrow()
    })
  })
}) 