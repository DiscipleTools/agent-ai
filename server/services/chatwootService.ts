import settingsService from './settingsService'

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
      if (chatwootSettings?.enabled && chatwootSettings.url) {
        return {
          url: chatwootSettings.url,
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

      // Use configured URL or fall back to environment URL if we have a custom API key
      const baseUrl = config.url || this.chatwootUrl
      const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`
      
      const requestBody = {
        content,
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

      // Use configured URL or fall back to environment URL if we have a custom API key
      const baseUrl = config.url || this.chatwootUrl
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
}

export default new ChatwootService() 