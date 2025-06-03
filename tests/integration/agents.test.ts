import { describe, it, expect } from 'vitest'
import { $fetch } from 'ofetch'
import { testUsers, testAgents, getAuthHeaders } from '../setup'

const BASE_URL = 'http://localhost:3000'

describe('Agents API', () => {
  describe('GET /api/agents', () => {
    it('should allow admin to see all agents', async () => {
      const headers = getAuthHeaders('admin')
      
      const response = await $fetch(`${BASE_URL}/api/agents`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBe(2) // Should see both agents
    })

    it('should show only accessible agents to regular users', async () => {
      const headers = getAuthHeaders('user')
      
      const response = await $fetch(`${BASE_URL}/api/agents`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBe(1) // Should only see userAgent
      expect(response.data[0].name).toBe('User Agent')
    })

    it('should reject unauthenticated access', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/agents`)
      ).rejects.toThrow()
    })
  })

  describe('POST /api/agents', () => {
    it('should allow authenticated users to create agents', async () => {
      const headers = getAuthHeaders('user')
      
      const response = await $fetch(`${BASE_URL}/api/agents`, {
        method: 'POST',
        headers,
        body: {
          name: 'New Test Agent',
          description: 'A new test agent',
          prompt: 'You are a helpful assistant',
          model: 'gpt-3.5-turbo'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('New Test Agent')
    })

    it('should reject unauthenticated agent creation', async () => {
      await expect(
        $fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          body: {
            name: 'Unauthorized Agent',
            description: 'Should not be created',
            prompt: 'You are a helpful assistant',
            model: 'gpt-3.5-turbo'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('GET /api/agents/[id]', () => {
    it('should allow admin to access any agent', async () => {
      const headers = getAuthHeaders('admin')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('User Agent')
    })

    it('should allow users to access their assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}`, {
        headers
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('User Agent')
    })

    it('should reject user access to non-assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}`, {
          headers
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated access', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}`)
      ).rejects.toThrow()
    })
  })

  describe('PUT /api/agents/[id]', () => {
    it('should allow admin to update any agent', async () => {
      const headers = getAuthHeaders('admin')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}`, {
        method: 'PUT',
        headers,
        body: {
          name: 'Updated Agent Name'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('Updated Agent Name')
    })

    it('should allow users to update their assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}`, {
        method: 'PUT',
        headers,
        body: {
          description: 'Updated description'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.description).toBe('Updated description')
    })

    it('should reject user updates to non-assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}`, {
          method: 'PUT',
          headers,
          body: {
            name: 'Hacked Agent'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated updates', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}`, {
          method: 'PUT',
          body: {
            name: 'Hacked Agent'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('DELETE /api/agents/[id]', () => {
    it('should allow admin to delete any agent', async () => {
      const headers = getAuthHeaders('admin')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers
      })

      expect(response.success).toBe(true)
    })

    it('should allow users to delete their assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.userAgent._id.toString()
      
      const response = await $fetch(`${BASE_URL}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers
      })

      expect(response.success).toBe(true)
    })

    it('should reject user deletion of non-assigned agents', async () => {
      const headers = getAuthHeaders('user')
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}`, {
          method: 'DELETE',
          headers
        })
      ).rejects.toThrow()
    })

    it('should reject unauthenticated deletion', async () => {
      const agentId = testAgents.publicAgent._id.toString()
      
      await expect(
        $fetch(`${BASE_URL}/api/agents/${agentId}`, {
          method: 'DELETE'
        })
      ).rejects.toThrow()
    })
  })
}) 