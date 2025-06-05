import { describe, it, expect } from 'vitest'
import { $fetch } from 'ofetch'
import { testUsers, getAuthHeaders } from '../setup'

const BASE_URL = 'http://localhost:3000'

describe('Profile API', () => {
  describe('PUT /api/auth/profile', () => {
    it('should update user name for authenticated user', async () => {
      const headers = getAuthHeaders('user')
      
      const response = await $fetch(`${BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers,
        body: {
          name: 'Updated User Name'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('Updated User Name')
      expect(response.data.email).toBe(testUsers.user.email)
      expect(response.message).toBe('Profile updated successfully')
      expect(response.data).not.toHaveProperty('password')
    })

    it('should update user email for authenticated user', async () => {
      const headers = getAuthHeaders('user')
      
      const response = await $fetch(`${BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers,
        body: {
          email: 'newemail@test.com'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.email).toBe('newemail@test.com')
      expect(response.data.name).toBe(testUsers.user.name)
      expect(response.message).toBe('Profile updated successfully')
    })

    it('should update both name and email for authenticated user', async () => {
      const headers = getAuthHeaders('user')
      
      const response = await $fetch(`${BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers,
        body: {
          name: 'New Name',
          email: 'newemail@test.com'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('New Name')
      expect(response.data.email).toBe('newemail@test.com')
      expect(response.message).toBe('Profile updated successfully')
    })

    it('should update password with valid current password', async () => {
      const headers = getAuthHeaders('user')
      
      const response = await $fetch(`${BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers,
        body: {
          currentPassword: testUsers.user.password,
          newPassword: 'newpassword123'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.email).toBe(testUsers.user.email)
      expect(response.message).toBe('Profile updated successfully')
      expect(response.data).not.toHaveProperty('password')
    })

    it('should reject password update with incorrect current password', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers,
          body: {
            currentPassword: 'wrongpassword',
            newPassword: 'newpassword123'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject password update without current password', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers,
          body: {
            newPassword: 'newpassword123'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject short new password', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers,
          body: {
            currentPassword: testUsers.user.password,
            newPassword: 'short'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject empty name', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers,
          body: {
            name: ''
          }
        })
      ).rejects.toThrow()
    })

    it('should reject empty email', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers,
          body: {
            email: ''
          }
        })
      ).rejects.toThrow()
    })

    it('should reject invalid email format', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers,
          body: {
            email: 'invalid-email'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject duplicate email address', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers,
          body: {
            email: testUsers.admin.email
          }
        })
      ).rejects.toThrow()
    })

    it('should allow admin to update their profile', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers,
        body: {
          name: 'Updated Admin Name'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('Updated Admin Name')
      expect(response.data.role).toBe('admin')
    })

    it('should reject request without authentication', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          body: {
            name: 'Test Name'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject request with invalid token', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer invalid-token',
            'Content-Type': 'application/json'
          },
          body: {
            name: 'Test Name'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject request for inactive user', async () => {
      const headers = getAuthHeaders('inactive')
      
      await expect(
        $fetch(`${BASE_URL}/api/auth/profile`, {
          method: 'PUT',
          headers,
          body: {
            name: 'Test Name'
          }
        })
      ).rejects.toThrow()
    })

    it('should trim whitespace from name and email', async () => {
      const headers = getAuthHeaders('user')
      
      const response = await $fetch(`${BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers,
        body: {
          name: '  Trimmed Name  ',
          email: '  trimmed@test.com  '
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('Trimmed Name')
      expect(response.data.email).toBe('trimmed@test.com')
    })

    it('should update profile with all fields at once', async () => {
      const headers = getAuthHeaders('user')
      
      const response = await $fetch(`${BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers,
        body: {
          name: 'Complete Update',
          email: 'complete@test.com',
          currentPassword: testUsers.user.password,
          newPassword: 'newcompletepass123'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('Complete Update')
      expect(response.data.email).toBe('complete@test.com')
      expect(response.message).toBe('Profile updated successfully')
    })
  })
}) 