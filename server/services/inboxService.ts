import Inbox from '~/server/models/Inbox'
import Agent from '~/server/models/Agent'
import chatwootService from './chatwootService'
import axios from 'axios'
import { Types } from 'mongoose'
import { sanitizeText, sanitizeObjectId } from '~/utils/sanitize'

function generateWebhookSecret(): string {
  return Buffer.from(Math.random().toString()).toString('base64').slice(0, 32)
}

/**
 * Maps Chatwoot channel types to model enum values
 * Chatwoot uses format like "Channel::WebWidget", we need "web_widget"
 */
function mapChatwootChannelType(chatwootChannelType: string): string {
  if (!chatwootChannelType) {
    return 'api' // default fallback
  }

  // Remove "Channel::" prefix if present and convert to lowercase
  const cleanType = chatwootChannelType.replace(/^Channel::/, '').toLowerCase()
  
  // Map specific Chatwoot types to our enum values
  const channelTypeMap: { [key: string]: string } = {
    'webwidget': 'web_widget',
    'web_widget': 'web_widget',
    'email': 'email',
    'api': 'api',
    'whatsapp': 'whatsapp',
    'facebook': 'facebook',
    'twitter': 'twitter',
    'telegram': 'telegram',
    'line': 'line',
    'sms': 'sms',
    'website': 'website'
  }

  return channelTypeMap[cleanType] || 'api' // fallback to 'api' if unknown
}

class InboxService {
  
  // ==================== INBOX CRUD OPERATIONS ====================

  /**
   * Get user's accessible inboxes from Chatwoot and sync them
   * @param user - Authenticated user object
   * @returns Promise<Inbox[]>
   */
  async getInboxesForUser(user: any) {
    try {
      // Sync inboxes from Chatwoot first
      await this.syncUserInboxes(user)

      // Get user's administered accounts
      const adminAccountIds = user.chatwoot?.accounts
        ?.filter((account: any) => account.role === 'administrator')
        ?.map((account: any) => account.id) || []

      // For super admins, return all inboxes
      if (user.superadmin) {
        return await Inbox.find().populate('responseAgent.agentId agents.agentId')
      }

      // For regular users, return only inboxes from accounts they administer
      if (adminAccountIds.length === 0) {
        return []
      }

      return await Inbox.find({
        accountId: { $in: adminAccountIds }
      }).populate('responseAgent.agentId agents.agentId')
    } catch (error) {
      console.error('Error getting inboxes for user:', error)
      throw error
    }
  }

  /**
   * Sync user's inboxes from Chatwoot
   * @param user - Authenticated user object  
   * @returns Promise<SyncResult>
   */
  async syncUserInboxes(user: any) {
    try {
      // Get user's accessible accounts
      const userAccounts = user.chatwoot?.accounts || []
      
      // Super admins can sync all accounts, regular users only their admin accounts
      const accountsToSync = user.superadmin ? userAccounts : userAccounts.filter((account: any) => account.role === 'administrator')

      const syncResults = {
        created: [] as any[],
        updated: [] as any[],
        errors: [] as any[]
      }

      for (const account of accountsToSync) {
        try {
          const accountResults = await this.syncAccountInboxes(account.id, user)
          syncResults.created.push(...accountResults.created)
          syncResults.updated.push(...accountResults.updated)
          syncResults.errors.push(...accountResults.errors)
        } catch (error: any) {
          syncResults.errors.push({
            accountId: account.id,
            error: error.message
          })
        }
      }

      return { 
        success: true, 
        message: 'Inboxes synced successfully',
        results: syncResults
      }
    } catch (error: any) {
      console.error('Error syncing user inboxes:', error)
      throw new Error(`Failed to sync inboxes: ${error.message}`)
    }
  }

  /**
   * Sync inboxes for a specific Chatwoot account
   * @param accountId - Chatwoot account ID
   * @param user - Authenticated user object
   * @returns Promise<SyncResult>
   */
  private async syncAccountInboxes(accountId: number, user: any) {
    try {
      const chatwootInstanceUrl = (process.env.CHATWOOT_URL || 'http://localhost:5600').replace(/\/$/, '')
      
      // Get session data from the user object (set during authentication)
      const sessionData = user.chatwootSessionData
      if (!sessionData) {
        throw new Error('No Chatwoot session data available in user object')
      }

      const { 'access-token': accessToken, client, uid } = sessionData

      const response = await axios.get(`${chatwootInstanceUrl}/api/v1/accounts/${accountId}/inboxes`, {
        headers: {
          'access-token': accessToken,
          'client': client,
          'uid': uid,
          'accept': 'application/json'
        }
      })

      const chatwootInboxes = response.data.payload || response.data

      const syncResults = {
        created: [] as any[],
        updated: [] as any[],
        errors: [] as any[]
      }

      for (const chatwootInbox of chatwootInboxes) {
        try {
          const result = await this.syncSingleInbox(chatwootInbox, accountId, user._id)
          if (result.created) {
            syncResults.created.push(result)
          } else {
            syncResults.updated.push(result)
          }
        } catch (error: any) {
          syncResults.errors.push({
            inboxId: chatwootInbox.id,
            name: chatwootInbox.name,
            error: error.message
          })
        }
      }

      return syncResults
    } catch (error: any) {
      console.error(`Error syncing inboxes for account ${accountId}:`, error)
      throw error
    }
  }

  /**
   * Sync a single inbox from Chatwoot
   * @param chatwootInbox - Chatwoot inbox data
   * @param accountId - Account ID
   * @param userId - User ID
   * @returns Promise<any>
   */
  private async syncSingleInbox(chatwootInbox: any, accountId: number, userId: string) {
    try {
      // Check if inbox already exists
      let inbox = await Inbox.findOne({
        accountId,
        inboxId: chatwootInbox.id
      })

      if (!inbox) {
        // Generate new ObjectId for webhook URL
        const newId = new Types.ObjectId()
        const webhookUrl = `/api/webhook/inbox/${newId}`

        // Create new inbox
        inbox = new Inbox({
          _id: newId,
          accountId,
          inboxId: chatwootInbox.id,
          name: sanitizeText(chatwootInbox.name || ''),
          channelType: mapChatwootChannelType(chatwootInbox.channel_type),
          webhookUrl,
          webhookSecret: generateWebhookSecret(),
          chatwoot: {
            isConfigured: false,
            lastSync: new Date()
          },
          settings: {
            processDelay: 0,
            enableLogging: true,
            enableAnalytics: true
          },
          createdBy: userId,
          isActive: true
        })

        await inbox.save()
        
        return {
          id: inbox._id,
          name: inbox.name,
          inboxId: inbox.inboxId,
          created: true
        }
      } else {
        // Update existing inbox
        inbox.name = sanitizeText(chatwootInbox.name || '')
        inbox.channelType = mapChatwootChannelType(chatwootInbox.channel_type)
        inbox.chatwoot.lastSync = new Date()

        await inbox.save()
        
        return {
          id: inbox._id,
          name: inbox.name,
          inboxId: inbox.inboxId,
          created: false
        }
      }
    } catch (error: any) {
      console.error(`Error syncing single inbox ${chatwootInbox.id}:`, error)
      throw error
    }
  }
  
  /**
   * Create a new inbox (deprecated - inboxes should come from Chatwoot)
   * @param data - Inbox data
   * @returns Promise<Inbox>
   */
  async createInbox(data: any) {
    throw new Error('Cannot create inboxes manually. Inboxes must be created in Chatwoot and will be automatically synced.')
  }

  /**
   * Update an existing inbox
   * @param id - Inbox ID
   * @param data - Update data
   * @returns Promise<Inbox>
   */
  async updateInbox(id: string, data: any) {
    try {
      const inbox = await Inbox.findById(id)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      // Update fields
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'chatwoot' && typeof value === 'object') {
          inbox.chatwoot = { ...inbox.chatwoot, ...value }
        } else if (key === 'settings' && typeof value === 'object') {
          inbox.settings = { ...inbox.settings, ...value }
        } else {
          (inbox as any)[key] = value
        }
      })

      await inbox.save()
      
      // Populate agent references
      await inbox.populate([
        { path: 'responseAgent.agentId', select: 'name agentType description' },
        { path: 'agents.agentId', select: 'name agentType description' }
      ])
      
      return inbox
    } catch (error) {
      console.error('Error updating inbox:', error)
      throw error
    }
  }

  /**
   * Delete an inbox
   * @param id - Inbox ID
   * @returns Promise<Inbox>
   */
  async deleteInbox(id: string) {
    try {
      const inbox = await Inbox.findByIdAndDelete(id)
      if (!inbox) {
        throw new Error('Inbox not found')
      }
      return inbox
    } catch (error) {
      console.error('Error deleting inbox:', error)
      throw error
    }
  }

  /**
   * Get inbox by ID
   * @param id - Inbox ID
   * @returns Promise<Inbox>
   */
  async getInbox(id: string) {
    try {
      const inbox = await Inbox.findById(id)
        .populate('responseAgent.agentId', 'name agentType description settings')
        .populate('agents.agentId', 'name agentType description settings')

      if (!inbox) {
        throw new Error('Inbox not found')
      }
      
      return inbox
    } catch (error) {
      console.error('Error getting inbox:', error)
      throw error
    }
  }

  /**
   * Get inboxes by creator with optional filters
   * @param createdBy - Creator ID
   * @param filters - Optional filters
   * @returns Promise<Inbox[]>
   */
  async getInboxesByCreator(createdBy: any, filters: any = {}) {
    try {
      const query = { createdBy, ...filters }
      
      const inboxes = await Inbox.find(query)
        .populate('responseAgent.agentId', 'name agentType description')
        .populate('agents.agentId', 'name agentType description')
        .sort({ createdAt: -1 })
      
      return inboxes
    } catch (error) {
      console.error('Error getting inboxes by creator:', error)
      throw error
    }
  }

  // ==================== CHATWOOT INTEGRATION ====================

  /**
   * Sync inboxes with Chatwoot
   * @param accountId - Chatwoot account ID
   * @param apiKey - Optional API key
   * @param createdBy - User ID
   * @returns Promise<SyncResult>
   */
  async syncWithChatwoot(accountId: number, createdBy: any, apiKey?: string) {
    try {
      const chatwootUrl = process.env.CHATWOOT_URL
      const systemApiToken = process.env.CHATWOOT_API_TOKEN
      
      if (!chatwootUrl) {
        throw new Error('Chatwoot URL not configured')
      }

      const authToken = apiKey || systemApiToken
      if (!authToken) {
        throw new Error('API key required')
      }

      // Fetch inboxes from Chatwoot
      const response = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/inboxes`, {
        headers: {
          'api_access_token': authToken,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Chatwoot API error: ${response.status} ${response.statusText} - ${errorData}`)
      }

      const chatwootData = await response.json()
      const chatwootInboxes = chatwootData.payload || chatwootData

      if (!Array.isArray(chatwootInboxes)) {
        throw new Error('Invalid response format from Chatwoot API')
      }

      const syncResults = {
        created: [] as any[],
        updated: [] as any[],
        errors: [] as any[]
      }

      // Process each Chatwoot inbox
      for (const chatwootInbox of chatwootInboxes) {
        try {
          const existingInbox = await Inbox.findOne({
            accountId: accountId,
            inboxId: chatwootInbox.id
          })

          if (existingInbox) {
            // Update existing inbox
            existingInbox.name = chatwootInbox.name
            existingInbox.channelType = mapChatwootChannelType(chatwootInbox.channel_type)
            existingInbox.chatwoot = {
              ...existingInbox.chatwoot,
              apiKey: apiKey || existingInbox.chatwoot.apiKey,
              lastSync: new Date()
            }
            
            await existingInbox.save()
            syncResults.updated.push({
              id: existingInbox._id,
              name: existingInbox.name,
              inboxId: existingInbox.inboxId
            })
          } else {
            // Create new inbox
            const newInboxData = {
              accountId: accountId,
              inboxId: chatwootInbox.id,
              name: chatwootInbox.name,
              channelType: mapChatwootChannelType(chatwootInbox.channel_type),
              chatwoot: {
                apiKey: apiKey,
                isConfigured: false,
                lastSync: new Date()
              },
              createdBy
            }
            
            const newInbox = await this.createInbox(newInboxData)
            syncResults.created.push({
              id: newInbox._id,
              name: newInbox.name,
              inboxId: newInbox.inboxId
            })
          }
        } catch (inboxError: any) {
          console.error(`Error processing inbox ${chatwootInbox.id}:`, inboxError)
          syncResults.errors.push({
            inboxId: chatwootInbox.id,
            name: chatwootInbox.name,
            error: inboxError.message
          })
        }
      }

      return {
        accountId,
        totalProcessed: chatwootInboxes.length,
        results: syncResults
      }
    } catch (error) {
      console.error('Error syncing with Chatwoot:', error)
      throw error
    }
  }

  /**
   * Configure webhook for an inbox
   * @param inboxId - Inbox ID
   * @returns Promise<string>
   */
  async configureWebhook(inboxId: string) {
    try {
      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      // The webhook URL is already generated when the inbox is created
      // This method could be extended to register the webhook with Chatwoot
      // For now, just return the webhook URL
      return inbox.webhookUrl
    } catch (error) {
      console.error('Error configuring webhook:', error)
      throw error
    }
  }

  /**
   * Create or update bot in Chatwoot for this inbox
   * @param inboxId - Inbox ID
   * @param authHeaders - Authentication headers
   * @returns Promise<any>
   */
  async createOrUpdateBot(inboxId: string, authHeaders?: any) {
    try {
      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      const botName = `AI Agent Bot - ${inbox.name}`
      const botDescription = `AI agent bot for inbox ${inbox.name}`
      const baseUrl = process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'
      const webhookUrl = `${baseUrl}${inbox.webhookUrl}`

      // Check if bot already exists
      if (inbox.chatwoot.botId) {
        console.log(`Bot already exists for inbox ${inbox.name} (bot ID: ${inbox.chatwoot.botId})`)
        return {
          id: inbox.chatwoot.botId,
          name: inbox.chatwoot.botName,
          outgoing_url: webhookUrl,
          updated: false
        }
      }

      // Create new bot
      const botData = await chatwootService.createAgentBot(
        inbox.accountId,
        botName,
        botDescription,
        webhookUrl,
        authHeaders
      )

      // Update inbox with bot information
      inbox.chatwoot = {
        ...inbox.chatwoot,
        botId: botData.id,
        botName: botData.name,
        isConfigured: true
      }

      await inbox.save()

      // Configure the bot for this inbox
      await chatwootService.configureInboxBot(
        inbox.accountId,
        inbox.inboxId,
        botData.id,
        authHeaders
      )

      return {
        ...botData,
        updated: true
      }
    } catch (error) {
      console.error('Error creating/updating bot:', error)
      throw error
    }
  }

  // ==================== RESPONSE AGENT MANAGEMENT ====================

  /**
   * Assign response agent to inbox (enforces single agent constraint)
   * @param inboxId - Inbox ID
   * @param agentId - Agent ID
   * @param config - Agent configuration overrides
   * @returns Promise<Inbox>
   */
  async assignResponseAgent(inboxId: string, agentId: string, config: any = {}) {
    try {
      const agent = await Agent.findById(agentId)
      if (!agent) {
        throw new Error('Agent not found')
      }

      if (agent.agentType !== 'response') {
        throw new Error('Only response agents can be assigned as response agent')
      }

      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      // Check if agent is already in agents array
      const existingInAgentsArray = inbox.agents.find(a => a.agentId.toString() === agentId)
      if (existingInAgentsArray) {
        throw new Error('Response agent cannot be in both response agent and agents array')
      }

      inbox.assignResponseAgent(agentId, config)
      await inbox.save()

      // Populate agent details
      await inbox.populate('responseAgent.agentId', 'name agentType description')

      return inbox
    } catch (error) {
      console.error('Error assigning response agent:', error)
      throw error
    }
  }

  /**
   * Remove response agent from inbox
   * @param inboxId - Inbox ID
   * @returns Promise<Inbox>
   */
  async removeResponseAgent(inboxId: string) {
    try {
      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      if (!inbox.responseAgent?.agentId) {
        throw new Error('No response agent is currently assigned')
      }

      inbox.removeResponseAgent()
      await inbox.save()

      return inbox
    } catch (error) {
      console.error('Error removing response agent:', error)
      throw error
    }
  }

  // ==================== AGENTS ARRAY MANAGEMENT ====================

  /**
   * Add agent to agents array
   * @param inboxId - Inbox ID
   * @param agentId - Agent ID
   * @param priority - Agent priority
   * @param config - Agent configuration overrides
   * @returns Promise<Inbox>
   */
  async addAgent(inboxId: string, agentId: string, priority: number = 100, config: any = {}) {
    try {
      const agent = await Agent.findById(agentId)
      if (!agent) {
        throw new Error('Agent not found')
      }

      if (agent.agentType === 'response') {
        throw new Error('Response agents must be assigned as response agent, not in agents array')
      }

      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      // Check if agent is already assigned as response agent
      if (inbox.responseAgent?.agentId?.toString() === agentId) {
        throw new Error('Agent is already assigned as response agent')
      }

      inbox.addAgent(agentId, agent.agentType, agent.name, priority, config)
      await inbox.save()

      // Populate agent details
      await inbox.populate('agents.agentId', 'name agentType description')

      return inbox
    } catch (error) {
      console.error('Error adding agent:', error)
      throw error
    }
  }

  /**
   * Remove agent from agents array
   * @param inboxId - Inbox ID
   * @param agentId - Agent ID
   * @returns Promise<Inbox>
   */
  async removeAgent(inboxId: string, agentId: string) {
    try {
      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      inbox.removeAgent(agentId)
      await inbox.save()

      return inbox
    } catch (error) {
      console.error('Error removing agent:', error)
      throw error
    }
  }

  /**
   * Update agent configuration in agents array
   * @param inboxId - Inbox ID
   * @param agentId - Agent ID
   * @param updates - Update data
   * @returns Promise<Inbox>
   */
  async updateAgentConfig(inboxId: string, agentId: string, updates: any) {
    try {
      const inbox = await Inbox.findById(inboxId)
      if (!inbox) {
        throw new Error('Inbox not found')
      }

      const agent = inbox.agents.find(a => a.agentId.toString() === agentId)
      if (!agent) {
        throw new Error('Agent is not assigned to this inbox')
      }

      // Update fields
      if (updates.priority !== undefined) {
        agent.priority = updates.priority
      }
      
      if (updates.isActive !== undefined) {
        agent.isActive = updates.isActive
      }
      
      if (updates.config !== undefined) {
        agent.config = { ...agent.config, ...updates.config }
      }

      // Re-sort agents by priority if priority was changed
      if (updates.priority !== undefined) {
        inbox.agents.sort((a, b) => a.priority - b.priority)
      }

      await inbox.save()

      // Populate agent details
      await inbox.populate('agents.agentId', 'name agentType description')

      return inbox
    } catch (error) {
      console.error('Error updating agent config:', error)
      throw error
    }
  }

  // ==================== EVENT PROCESSING ====================

  /**
   * Process webhook event for an inbox
   * @param inboxId - Inbox ID
   * @param event - Webhook event data
   * @returns Promise<any>
   */
  async processWebhookEvent(inboxId: string, event: any) {
    try {
      // This is a placeholder - the actual processing is handled by the webhook endpoint
      // This method could be used for additional processing or logging
      console.log(`Processing webhook event for inbox ${inboxId}:`, event.event)
      
      return {
        success: true,
        inboxId,
        event: event.event,
        processedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error processing webhook event:', error)
      throw error
    }
  }

  /**
   * Route message to agents based on inbox configuration
   * @param inboxId - Inbox ID
   * @param message - Message data
   * @returns Promise<any>
   */
  async routeToAgents(inboxId: string, message: any) {
    try {
      const inbox = await Inbox.findById(inboxId)
        .populate('responseAgent.agentId')
        .populate('agents.agentId')

      if (!inbox || !inbox.isActive) {
        throw new Error('Inbox not found or inactive')
      }

      // Get processing order
      const sortedAgents = inbox.agents
        .filter(a => a.isActive && a.agentId)
        .sort((a, b) => a.priority - b.priority)

      return {
        inbox: {
          id: inbox._id,
          name: inbox.name
        },
        processing: {
          responseAgent: inbox.responseAgent?.agentId || null,
          preProcessAgents: sortedAgents.filter(a => a.priority < 100),
          mainProcessAgents: sortedAgents.filter(a => a.priority >= 100 && a.priority < 200),
          postProcessAgents: sortedAgents.filter(a => a.priority >= 200)
        }
      }
    } catch (error) {
      console.error('Error routing to agents:', error)
      throw error
    }
  }
}

export default new InboxService()