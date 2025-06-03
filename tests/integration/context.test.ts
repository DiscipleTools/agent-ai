import { describe, it, expect } from 'vitest'
import { $fetch } from 'ofetch'
import { testUsers, testAgents, getAuthHeaders } from '../setup'

const BASE_URL = 'http://localhost:3000'

describe('Agent Context API', () => {
  describe('GET /api/agents/[id]/context', () => {
    it('should allow admin to access any agent context', async () => {
      const headers = getAuthHeaders('admin')
      const agentId = testAgents.publicAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}/context`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('contextDocuments')
      expect(Array.isArray(response.data.contextDocuments)).toBe(true)
    })

    it('should allow users to access their assigned agent context', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}/context`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('contextDocuments')
      expect(Array.isArray(response.data.contextDocuments)).toBe(true)
    })

    it('should reject user access to non-assigned agent context', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context`, {
          headers
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated access', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context`)
      ).rejects.toThrow()
    })
  })

  describe('POST /api/agents/[id]/context/url', () => {
    it('should allow admin to add URL context to any agent', async () => {
      const headers = getAuthHeaders('admin')
      const agentId = testAgents.publicAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}/context/url`, {
        method: 'POST',
        headers,
        body: {
          url: 'https://example.com',
          title: 'Test URL'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('contextDocument')
    })

    it('should allow users to add URL context to their assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}/context/url`, {
        method: 'POST',
        headers,
        body: {
          url: 'https://example.com',
          title: 'Test URL'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('contextDocument')
    })

    it('should reject user adding context to non-assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/url`, {
          method: 'POST',
          headers,
          body: {
            url: 'https://example.com',
            title: 'Test URL'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated context addition', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/url`, {
          method: 'POST',
          body: {
            url: 'https://example.com',
            title: 'Test URL'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('POST /api/agents/[id]/context/test-url', () => {
    it('should allow admin to test URLs for any agent', async () => {
      const headers = getAuthHeaders('admin')
      const agentId = testAgents.publicAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}/context/test-url`, {
        method: 'POST',
        headers,
        body: {
          url: 'https://example.com'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('accessible')
    })

    it('should allow users to test URLs for their assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}/context/test-url`, {
        method: 'POST',
        headers,
        body: {
          url: 'https://example.com'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('accessible')
    })

    it('should reject user testing URLs for non-assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/test-url`, {
          method: 'POST',
          headers,
          body: {
            url: 'https://example.com'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated URL testing', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/test-url`, {
          method: 'POST',
          body: {
            url: 'https://example.com'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('POST /api/agents/[id]/context/upload', () => {
    it('should reject unauthenticated file upload', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/upload`, {
          method: 'POST',
          body: new FormData()
        })
      ).rejects.toThrow()
    })

    it('should reject user upload to non-assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/upload`, {
          method: 'POST',
          headers,
          body: new FormData()
        })
      ).rejects.toThrow()
    })
  })

  describe('DELETE /api/agents/[id]/context/[docId]', () => {
    it('should reject unauthenticated context deletion', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      const docId = 'test-doc-id'
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/${docId}`, {
          method: 'DELETE'
        })
      ).rejects.toThrow()
    })

    it('should reject user deletion from non-assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      const docId = 'test-doc-id'
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/${docId}`, {
          method: 'DELETE',
          headers
        })
      ).rejects.toThrow()
    })
  })

  describe('PUT /api/agents/[id]/context/[docId]', () => {
    it('should reject unauthenticated context updates', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      const docId = 'test-doc-id'
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/${docId}`, {
          method: 'PUT',
          body: {
            title: 'Updated Title'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject user updates to non-assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      const docId = 'test-doc-id'
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/${docId}`, {
          method: 'PUT',
          headers,
          body: {
            title: 'Updated Title'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('GET /api/agents/[id]/context/[docId]', () => {
    it('should reject unauthenticated context access', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      const docId = 'test-doc-id'
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/${docId}`)
      ).rejects.toThrow()
    })

    it('should reject user access to non-assigned agent contexts', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      const docId = 'test-doc-id'
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}/context/${docId}`, {
          headers
        })
      ).rejects.toThrow()
    })
  })
}) 