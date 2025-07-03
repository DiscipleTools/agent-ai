import { describe, it, expect } from 'vitest'
import { $fetch } from 'ofetch'
import { testUsers, getAuthHeaders } from '../setup'

const BASE_URL = 'http://localhost:3000'

describe('Settings API', () => {
  describe('GET /api/settings', () => {
    it('should allow admin to read settings', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/settings`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('predictionGuard')
    })

    it('should reject regular user access', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/settings`, {
          headers
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated access', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/settings`)
      ).rejects.toThrow()
    })
  })

  describe('PUT /api/settings', () => {
    it('should allow admin to update settings', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/settings`, {
        method: 'PUT',
        headers,
        body: {
          predictionGuard: {
            endpoint: 'https://api.predictionguard.com',
            model: 'gpt-4',
            apiKey: 'test-key'
          }
        }
      })

      expect(response.success).toBe(true)
    })

    it('should reject regular user updates', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/settings`, {
          method: 'PUT',
          headers,
          body: {
            predictionGuard: {
              endpoint: 'https://api.predictionguard.com',
              model: 'gpt-4',
              apiKey: 'test-key'
            }
          }
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated updates', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/settings`, {
          method: 'PUT',
          body: {
            predictionGuard: {
              endpoint: 'https://api.predictionguard.com',
              model: 'gpt-4',
              apiKey: 'test-key'
            }
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('POST /api/settings/test-email', () => {
    it('should allow admin to test email configuration', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/settings/test-email`, {
        method: 'POST',
        headers,
        body: {
          recipientEmail: 'test@example.com'
        }
      })

      expect(response.success).toBeDefined()
    })

    it('should reject regular user email testing', async () => {
      const headers = getAuthHeaders('user')
      
      await expect(
        $fetch(`${BASE_URL}/api/settings/test-email`, {
          method: 'POST',
          headers,
          body: {
            recipientEmail: 'test@example.com'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated email testing', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/settings/test-email`, {
          method: 'POST',
          body: {
            recipientEmail: 'test@example.com'
          }
        })
      ).rejects.toThrow()
    })
  })
})

describe('Health API', () => {
  describe('GET /api/health', () => {
    it('should allow unauthenticated health checks', async () => {
      const response = await $fetch(`${BASE_URL}/api/health`)

      expect(response.status).toBe('OK')
      expect(response).toHaveProperty('timestamp')
      expect(response.message).toBe('Agent AI Server is running')
    })
  })
}) 