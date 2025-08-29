/**
 * Chatwoot Service
 * 
 * This service is responsible for all interactions with the Chatwoot API.
 * It handles sending messages, retrieving conversation history, and updating
 * conversation statuses. It can use system-wide Chatwoot credentials from
 * settings or environment variables, or it can use agent-specific API keys.
 * 
 * Used by:
 * - POST /api/webhook/agent/[id]/chat
 */
import settingsService from './settingsService'
import { sanitizeUrl, sanitizeContent, sanitizeText } from '~/utils/sanitize'

class ChatwootService {
  private chatwootUrl: string
  private apiToken: string

  constructor() {
    this.chatwootUrl = process.env.CHATWOOT_URL || ''
    this.apiToken = process.env.CHATWOOT_API_TOKEN || ''
  }

  private async getChatwootConfig(): Promise<{ url: string; apiToken: string }> {
    try {
      const chatwootSettings = await settingsService.getChatwootSettings()
      
      // Check if chatwoot is configured in settings and enabled
      if (chatwootSettings?.enabled) {
        return {
          url: this.chatwootUrl,
          apiToken: chatwootSettings.apiToken || this.apiToken
        }
      }
      
      // Fall back to environment variables
      return {
        url: this.chatwootUrl,
        apiToken: this.apiToken
      }
    } catch (error) {
      console.error('Failed to get chatwoot config from settings, using env vars:', error)
      // Fallback to environment variables on error
      return {
        url: this.chatwootUrl,
        apiToken: this.apiToken
      }
    }
  }

  async sendMessage(accountId: number, conversationId: number, content: string, customApiKey?: string): Promise<any> {
    try {
      // Get chatwoot configuration from settings or environment
      const config = await this.getChatwootConfig()
      
      // Use custom API key if provided, otherwise use configured token
      const apiKey = customApiKey || config.apiToken

      
      // If we have a custom API key but no URL, try environment URL
      if (customApiKey && !config.url && this.chatwootUrl) {
        console.log('Using environment Chatwoot URL with agent-specific API key')
      } else if (!config.url || !apiKey) {
        console.warn('Chatwoot URL or API token not configured. Message would be:', content)
        return { success: true, message: 'Message logged (Chatwoot not configured)' }
      }

      // Use environment URL
      const baseUrl = this.chatwootUrl
      const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`
      
      const requestBody = {
        content: sanitizeContent(content),
        message_type: 'outgoing'
      }

      console.log('Sending message to Chatwoot:', {
        url,
        accountId,
        conversationId,
        content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        usingCustomApiKey: !!customApiKey
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Chatwoot API error:', response.status, errorData)
        throw new Error(`Chatwoot API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Message sent successfully to Chatwoot')
      
      return data

    } catch (error: any) {
      console.error('Chatwoot Service Error:', error)
      throw new Error(`Failed to send message to Chatwoot: ${error.message}`)
    }
  }

  async getConversation(accountId: number, conversationId: number, customApiKey?: string): Promise<any> {
    try {
      // Get chatwoot configuration from settings or environment
      const config = await this.getChatwootConfig()
      
      // Use custom API key if provided, otherwise use configured token
      const apiKey = customApiKey || config.apiToken
      
      if (!config.url || !apiKey) {
        throw new Error('Chatwoot URL or API token not configured')
      }

      const url = `${config.url}/api/v1/accounts/${accountId}/conversations/${conversationId}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Chatwoot API error:', response.status, errorData)
        throw new Error(`Chatwoot API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()

    } catch (error: any) {
      console.error('Chatwoot Service Error:', error)
      throw new Error(`Failed to get conversation from Chatwoot: ${error.message}`)
    }
  }

  async getConversationMessages(accountId: number, conversationId: number, customApiKey?: string): Promise<any> {
    try {
      // Get chatwoot configuration from settings or environment
      const config = await this.getChatwootConfig()
      
      // Use custom API key if provided, otherwise use configured token
      const apiKey = customApiKey || config.apiToken
      
      // If we have a custom API key but no URL, we need a URL from somewhere
      if (customApiKey && !config.url) {
        // Try to construct URL from environment or throw informative error
        if (!this.chatwootUrl) {
          console.warn('Custom API key provided but no Chatwoot URL configured in settings or environment')
          return [] // Return empty array instead of throwing
        }
        // Use environment URL with custom API key
        console.log('Using environment Chatwoot URL with agent-specific API key')
      } else if (!config.url || !apiKey) {
        console.warn('Chatwoot URL or API token not configured - skipping conversation history')
        return [] // Return empty array instead of throwing
      }

      // Use environment URL
      const baseUrl = this.chatwootUrl
      const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`
      
      console.log('Fetching conversation messages from:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Chatwoot API error:', response.status, errorData)
        throw new Error(`Chatwoot API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Chatwoot returns messages in a 'payload' array, not directly
      console.log('Chatwoot API response:', data)
      const messages = data.payload || data
      console.log(`Retrieved ${messages?.length || 0} messages from conversation ${conversationId}`)
      
      return messages

    } catch (error: any) {
      console.error('Chatwoot Service Error:', error)
      throw new Error(`Failed to get conversation messages from Chatwoot: ${error.message}`)
    }
  }

  async updateConversationStatus(accountId: number, conversationId: number, status: string, customApiKey?: string): Promise<any> {
    try {
      // Get chatwoot configuration from settings or environment
      const config = await this.getChatwootConfig()
      
      // Use custom API key if provided, otherwise use configured token
      const apiKey = customApiKey || config.apiToken
      
      if (!config.url || !apiKey) {
        console.warn('Chatwoot URL or API token not configured. Cannot update conversation status.')
        return { success: false, message: 'Chatwoot not configured' }
      }

      // Validate status
      const allowedStatuses = ['open', 'resolved', 'pending', 'snoozed']
      if (!allowedStatuses.includes(status)) {
        throw new Error(`Invalid conversation status: ${status}`)
      }

      // Use environment URL
      const baseUrl = this.chatwootUrl
      const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`
      
      const requestBody = {
        status
      }

      console.log('Updating conversation status in Chatwoot:', {
        url,
        accountId,
        conversationId,
        status,
        usingCustomApiKey: !!customApiKey
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Chatwoot API error updating status:', response.status, errorData)
        throw new Error(`Chatwoot API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`Conversation status updated successfully to "${status}"`)
      
      return data

    } catch (error: any) {
      console.error('Chatwoot Service Error updating status:', error)
      throw new Error(`Failed to update conversation status in Chatwoot: ${error.message}`)
    }
  }




  /**
   * Create an agent bot in Chatwoot
   * @param accountId - The Chatwoot account ID
   * @param name - Name of the bot
   * @param description - Description of the bot
   * @param outgoingUrl - Webhook URL for the bot
   * @param authHeaders - Either API token or user session headers
   */
  async createAgentBot(
    accountId: number, 
    name: string, 
    description: string, 
    outgoingUrl: string, 
    authHeaders?: string | { 'access-token': string; client: string; uid: string; expiry?: string }
  ): Promise<any> {
    try {
      // Get Chatwoot URL from environment
      const baseUrl = this.chatwootUrl
      
      if (!baseUrl) {
        throw new Error('Chatwoot URL not configured')
      }

      const url = `${baseUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/agent_bots`
      
      const requestBody = {
        name: sanitizeText(name),
        description: sanitizeText(description),
        outgoing_url: sanitizeUrl(outgoingUrl, { allowLocalhost: true }),
        bot_type: 0 // Standard bot type
      }

      // Determine auth headers based on input type
      let headers: Record<string, string>
      if (typeof authHeaders === 'object' && authHeaders !== null) {
        // User session authentication
        headers = {
          'access-token': authHeaders['access-token'],
          'client': authHeaders.client,
          'uid': authHeaders.uid,
          'Content-Type': 'application/json'
        }
        console.log('Creating agent bot in Chatwoot with user session:', {
          url,
          accountId,
          name: requestBody.name,
          description: requestBody.description,
          outgoing_url: requestBody.outgoing_url,
          uid: authHeaders.uid
        })
      } else {
        // API key authentication
        const config = await this.getChatwootConfig()
        const apiKey = typeof authHeaders === 'string' ? authHeaders : config.apiToken
        
        if (!apiKey) {
          throw new Error('Chatwoot API token not configured')
        }
        
        headers = {
          'api_access_token': apiKey,
          'Content-Type': 'application/json'
        }
        console.log('Creating agent bot in Chatwoot with API key:', {
          url,
          accountId,
          name: requestBody.name,
          description: requestBody.description,
          outgoing_url: requestBody.outgoing_url,
          usingCustomApiKey: typeof authHeaders === 'string'
        })
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Chatwoot API error creating bot:', response.status, errorData)
        throw new Error(`Chatwoot API error: ${response.status} ${response.statusText} - ${errorData}`)
      }

      const data = await response.json()
      console.log('Agent bot created successfully in Chatwoot:', data)
      
      return data

    } catch (error: any) {
      console.error('Chatwoot Service Error creating bot:', error)
      throw new Error(`Failed to create agent bot in Chatwoot: ${error.message}`)
    }
  }

  /**
   * Configure an inbox to use a specific agent bot
   * @param accountId - The Chatwoot account ID
   * @param inboxId - The inbox ID to configure
   * @param agentBotId - The agent bot ID to assign
   * @param authHeaders - Either API token or user session headers
   */
  async configureInboxBot(
    accountId: number, 
    inboxId: number, 
    agentBotId: number, 
    authHeaders?: string | { 'access-token': string; client: string; uid: string; expiry?: string }
  ): Promise<any> {
    try {
      // Get Chatwoot URL from environment
      const baseUrl = this.chatwootUrl
      
      if (!baseUrl) {
        throw new Error('Chatwoot URL not configured')
      }

      const url = `${baseUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/inboxes/${inboxId}/set_agent_bot`
      
      const requestBody = {
        agent_bot: agentBotId
      }

      // Determine auth headers based on input type
      let headers: Record<string, string>
      if (typeof authHeaders === 'object' && authHeaders !== null) {
        // User session authentication
        headers = {
          'access-token': authHeaders['access-token'],
          'client': authHeaders.client,
          'uid': authHeaders.uid,
          'Content-Type': 'application/json'
        }
        console.log('Configuring inbox bot in Chatwoot with user session:', {
          url,
          accountId,
          inboxId,
          agentBotId,
          uid: authHeaders.uid
        })
      } else {
        // API key authentication
        const config = await this.getChatwootConfig()
        const apiKey = typeof authHeaders === 'string' ? authHeaders : config.apiToken
        
        if (!apiKey) {
          throw new Error('Chatwoot API token not configured')
        }
        
        headers = {
          'api_access_token': apiKey,
          'Content-Type': 'application/json'
        }
        console.log('Configuring inbox bot in Chatwoot with API key:', {
          url,
          accountId,
          inboxId,
          agentBotId,
          usingCustomApiKey: typeof authHeaders === 'string'
        })
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Chatwoot API error configuring inbox bot:', response.status, errorData)
        throw new Error(`Chatwoot API error: ${response.status} ${response.statusText} - ${errorData}`)
      }

      // Check if response has content before parsing JSON
      const responseText = await response.text()
      console.log('Chatwoot API response text:', responseText)
      
      let data
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText)
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError)
          console.error('Response text was:', responseText)
          throw new Error(`Invalid JSON response from Chatwoot API: ${responseText}`)
        }
      } else {
        // Empty response is often success for some endpoints
        data = { success: true }
      }
      
      console.log('Inbox bot configured successfully in Chatwoot')
      
      return data

    } catch (error: any) {
      console.error('Chatwoot Service Error configuring inbox bot:', error)
      throw new Error(`Failed to configure inbox bot in Chatwoot: ${error.message}`)
    }
  }

  /**
   * Delete an agent bot from Chatwoot
   * @param accountId - The Chatwoot account ID
   * @param agentBotId - The agent bot ID to delete
   * @param authHeaders - Either API token or user session headers
   */
  async deleteAgentBot(
    accountId: number, 
    agentBotId: number, 
    authHeaders?: string | { 'access-token': string; client: string; uid: string; expiry?: string }
  ): Promise<any> {
    try {
      // Get Chatwoot URL from environment
      const baseUrl = this.chatwootUrl
      
      if (!baseUrl) {
        throw new Error('Chatwoot URL not configured')
      }

      const url = `${baseUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/agent_bots/${agentBotId}`

      // Determine auth headers based on input type
      let headers: Record<string, string>
      if (typeof authHeaders === 'object' && authHeaders !== null) {
        // User session authentication
        headers = {
          'access-token': authHeaders['access-token'],
          'client': authHeaders.client,
          'uid': authHeaders.uid,
          'Content-Type': 'application/json'
        }
        console.log('Deleting agent bot from Chatwoot with user session:', {
          url,
          accountId,
          agentBotId,
          uid: authHeaders.uid
        })
      } else {
        // API key authentication
        const config = await this.getChatwootConfig()
        const apiKey = typeof authHeaders === 'string' ? authHeaders : config.apiToken
        
        if (!apiKey) {
          throw new Error('Chatwoot API token not configured')
        }
        
        headers = {
          'api_access_token': apiKey,
          'Content-Type': 'application/json'
        }
        console.log('Deleting agent bot from Chatwoot with API key:', {
          url,
          accountId,
          agentBotId,
          usingCustomApiKey: typeof authHeaders === 'string'
        })
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Chatwoot API error deleting bot:', response.status, errorData)
        throw new Error(`Chatwoot API error: ${response.status} ${response.statusText} - ${errorData}`)
      }

      console.log('Agent bot deleted successfully from Chatwoot')
      
      return { success: true }

    } catch (error: any) {
      console.error('Chatwoot Service Error deleting bot:', error)
      throw new Error(`Failed to delete agent bot from Chatwoot: ${error.message}`)
    }
  }
}

export default new ChatwootService() 