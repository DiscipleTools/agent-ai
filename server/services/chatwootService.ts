class ChatwootService {
  private chatwootUrl: string
  private apiToken: string

  constructor() {
    this.chatwootUrl = process.env.CHATWOOT_URL || ''
    this.apiToken = process.env.CHATWOOT_API_TOKEN || ''
  }

  async sendMessage(accountId: number, conversationId: number, content: string): Promise<any> {
    try {
      if (!this.chatwootUrl || !this.apiToken) {
        console.warn('Chatwoot URL or API token not configured. Message would be:', content)
        return { success: true, message: 'Message logged (Chatwoot not configured)' }
      }

      const url = `${this.chatwootUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`
      
      const requestBody = {
        content,
        message_type: 'outgoing'
      }

      console.log('Sending message to Chatwoot:', {
        url,
        accountId,
        conversationId,
        content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api_access_token': this.apiToken,
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

  async getConversation(accountId: number, conversationId: number): Promise<any> {
    try {
      if (!this.chatwootUrl || !this.apiToken) {
        throw new Error('Chatwoot URL or API token not configured')
      }

      const url = `${this.chatwootUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'api_access_token': this.apiToken,
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
}

export default new ChatwootService() 