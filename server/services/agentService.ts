import Agent from '~/server/models/Agent'
import Inbox from '~/server/models/Inbox'
import { Types } from 'mongoose'

class AgentService {
  
  // ==================== AGENT CRUD OPERATIONS ====================
  
  /**
   * Create a new agent
   * @param data - Agent data
   * @returns Promise<Agent>
   */
  async createAgent(data: any) {
    try {
      const agent = new Agent(data)
      await agent.save()
      return agent
    } catch (error) {
      console.error('Error creating agent:', error)
      throw error
    }
  }

  /**
   * Update an existing agent
   * @param id - Agent ID
   * @param data - Update data
   * @returns Promise<Agent>
   */
  async updateAgent(id: string, data: any) {
    try {
      const agent = await Agent.findById(id)
      if (!agent) {
        throw new Error('Agent not found')
      }

      // Update fields
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'settings' && typeof value === 'object') {
          agent.settings = { ...agent.settings, ...value }
        } else {
          (agent as any)[key] = value
        }
      })

      await agent.save()
      return agent
    } catch (error) {
      console.error('Error updating agent:', error)
      throw error
    }
  }

  /**
   * Delete an agent
   * @param id - Agent ID
   * @returns Promise<Agent>
   */
  async deleteAgent(id: string) {
    try {
      // First check if agent is assigned to any inboxes
      const assignedInboxes = await this.getAssignedInboxes(id)
      if (assignedInboxes.length > 0) {
        throw new Error(`Cannot delete agent: it is assigned to ${assignedInboxes.length} inbox(es). Remove from inboxes first.`)
      }

      const agent = await Agent.findByIdAndDelete(id)
      if (!agent) {
        throw new Error('Agent not found')
      }
      
      return agent
    } catch (error) {
      console.error('Error deleting agent:', error)
      throw error
    }
  }

  /**
   * Get agent by ID
   * @param id - Agent ID
   * @returns Promise<Agent>
   */
  async getAgent(id: string) {
    try {
      const agent = await Agent.findById(id)
      if (!agent) {
        throw new Error('Agent not found')
      }
      return agent
    } catch (error) {
      console.error('Error getting agent:', error)
      throw error
    }
  }

  /**
   * Get agents by creator with optional filters
   * @param createdBy - Creator ID
   * @param filters - Optional filters
   * @returns Promise<Agent[]>
   */
  async getAgentsByCreator(createdBy: any, filters: any = {}) {
    try {
      const query = { createdBy, ...filters }
      const agents = await Agent.find(query).sort({ createdAt: -1 })
      return agents
    } catch (error) {
      console.error('Error getting agents by creator:', error)
      throw error
    }
  }


  // ==================== INBOX ASSIGNMENT QUERIES ====================

  /**
   * Get all inboxes where an agent is assigned
   * @param agentId - Agent ID
   * @returns Promise<Inbox[]>
   */
  async getAssignedInboxes(agentId: string) {
    try {
      const inboxes = await Inbox.find({
        'agents.agentId': agentId
      })
      
      return inboxes
    } catch (error) {
      console.error('Error getting assigned inboxes:', error)
      throw error
    }
  }

  /**
   * Get inbox assignments for an agent with details
   * @param agentId - Agent ID
   * @returns Promise<AssignmentDetails>
   */
  async getAgentAssignments(agentId: string) {
    try {
      const inboxes = await Inbox.find({
        'agents.agentId': agentId
      }).select('name channelType agents accountId inboxId')

      const assignments = {
        processingPipeline: [] as any[]
      }

      for (const inbox of inboxes) {
        // Response agent functionality removed

        // Check if agent is in processing pipeline
        const agentInPipeline = inbox.agents.find((a: any) => a.agentId.toString() === agentId)
        if (agentInPipeline) {
          assignments.processingPipeline.push({
            inboxId: inbox._id,
            name: inbox.name,
            channelType: inbox.channelType,
            accountId: inbox.accountId,
            chatwootInboxId: inbox.inboxId,
            priority: agentInPipeline.priority,
            isActive: agentInPipeline.isActive,
            assignedAt: agentInPipeline.assignedAt,
            config: agentInPipeline.config
          })
        }
      }

      return {
        agentId,
        totalInboxes: inboxes.length,
        assignments
      }
    } catch (error) {
      console.error('Error getting agent assignments:', error)
      throw error
    }
  }

  // ==================== AGENT VALIDATION ====================

  /**
   * Validate if an agent can be assigned to an inbox
   * @param agentId - Agent ID
   * @param inboxId - Inbox ID
   * @param assignmentType - 'response' or 'processing'
   * @returns Promise<ValidationResult>
   */
  async validateAgentInboxAssignment(agentId: string, inboxId: string, assignmentType: 'response' | 'processing') {
    try {
      const agent = await Agent.findById(agentId)
      if (!agent) {
        return { isValid: false, reason: 'Agent not found' }
      }

      if (!agent.isActive) {
        return { isValid: false, reason: 'Agent is not active' }
      }

      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        return { isValid: false, reason: 'Inbox not found' }
      }

      if (!inbox.isActive) {
        return { isValid: false, reason: 'Inbox is not active' }
      }

      // Check if agent is already assigned in any capacity
      if (assignmentType === 'response') {
        // Check if agent is already in processing pipeline
        const existingInPipeline = inbox.agents.find((a: any) => a.agentId.toString() === agentId)
        if (existingInPipeline) {
          return { isValid: false, reason: 'Agent is already in processing pipeline' }
        }
      } else if (assignmentType === 'processing') {
        // Response agent functionality removed

        // Check if agent is already in processing pipeline
        const existingInPipeline = inbox.agents.find((a: any) => a.agentId.toString() === agentId)
        if (existingInPipeline) {
          return { isValid: false, reason: 'Agent is already in processing pipeline' }
        }
      }

      return { isValid: true }
    } catch (error) {
      console.error('Error validating agent inbox assignment:', error)
      return { isValid: false, reason: 'Validation error occurred' }
    }
  }

  // ==================== AGENT STATISTICS ====================

  /**
   * Get usage statistics for an agent
   * @param agentId - Agent ID
   * @returns Promise<AgentStats>
   */
  async getAgentStats(agentId: string) {
    try {
      const agent = await Agent.findById(agentId)
      if (!agent) {
        throw new Error('Agent not found')
      }

      const assignments = await this.getAgentAssignments(agentId)
      
      return {
        agentId,
        name: agent.name,
        isActive: agent.isActive,
        createdAt: agent.createdAt,
        assignments: assignments.assignments,
        totalInboxes: assignments.totalInboxes,
        contextDocuments: agent.contextDocuments?.length || 0
      }
    } catch (error) {
      console.error('Error getting agent stats:', error)
      throw error
    }
  }

  /**
   * Get available agents for assignment to an inbox
   * @param inboxId - Inbox ID  
   * @param assignmentType - 'response' or 'processing'
   * @param createdBy - Creator ID
   * @returns Promise<Agent[]>
   */
  async getAvailableAgentsForInbox(inboxId: string, assignmentType: 'response' | 'processing', createdBy: any) {
    try {
      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      // Get all agents
      const agents = await Agent.find({
        createdBy,
        isActive: true
      })

      // Filter out agents that are already assigned to this inbox
      const availableAgents = agents.filter(agent => {
        const agentId = agent._id.toString()

        if (assignmentType === 'response') {
          // Check if already in processing pipeline
          const isInPipeline = inbox.agents.some((a: any) => a.agentId.toString() === agentId)
          return !isInPipeline
        } else {
          // Check if already in processing pipeline
          const isInPipeline = inbox.agents.some((a: any) => a.agentId.toString() === agentId)
          return !isInPipeline
        }
      })

      return availableAgents
    } catch (error) {
      console.error('Error getting available agents for inbox:', error)
      throw error
    }
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk update agent status
   * @param agentIds - Array of agent IDs
   * @param isActive - New active status
   * @param createdBy - Creator ID for security
   * @returns Promise<BulkUpdateResult>
   */
  async bulkUpdateAgentStatus(agentIds: string[], isActive: boolean, createdBy: any) {
    try {
      const result = await Agent.updateMany(
        { 
          _id: { $in: agentIds }, 
          createdBy 
        },
        { isActive }
      )

      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        isActive
      }
    } catch (error) {
      console.error('Error bulk updating agent status:', error)
      throw error
    }
  }
}

export default new AgentService()