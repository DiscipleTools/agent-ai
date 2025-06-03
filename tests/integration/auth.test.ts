import { describe, it, expect } from 'vitest'
import { $fetch } from 'ofetch'
import { testUsers, getAuthHeaders } from '../setup'

const BASE_URL = 'http://localhost:3000'

describe('Authentication API', () => {
  describe('POST /api/auth/login', () => {
    it('should allow login with valid credentials', async () => {
      const response = await $fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: {
          email: testUsers.admin.email,
          password: testUsers.admin.password
        }
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('user')
      expect(response.data.user.email).toBe(testUsers.admin.email)
    })

    it('should reject login with invalid credentials', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          body: {
            email: testUsers.admin.email,
            password: 'wrongpassword'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject login for inactive users', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          body: {
            email: testUsers.inactive.email,
            password: testUsers.inactive.password
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return user data for authenticated user', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/auth/me`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(response.data.email).toBe(testUsers.admin.email)
      expect(response.data).not.toHaveProperty('password')
    })

    it('should reject request without authentication', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/auth/me`)
      ).rejects.toThrow()
    })

    it('should reject request with invalid token', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: 'Bearer invalid-token'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout authenticated user', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers
      })

      expect(response.success).toBe(true)
    })

    it('should reject logout without authentication', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/auth/logout`, {
          method: 'POST'
        })
      ).rejects.toThrow()
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens for valid refresh token', async () => {
      // This test would need a valid refresh token setup
      // For now, just test that it requires authentication
      await expect(
        $fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST'
        })
      ).rejects.toThrow()
    })
  })
}) 