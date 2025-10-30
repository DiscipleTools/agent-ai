/**
 * Toxicity Detection Service
 *
 * This service handles toxicity detection for messages using Prediction Guard API.
 * It uses user-provided examples to classify hostile/toxic content.
 * Uses the same AI connection system as the main AI service.
 */

import settingsService from './settingsService'

interface ToxicityResult {
  isToxic: boolean
}

interface ToxicityCheckOptions {
  examples?: string
  agentId?: string
}

class ToxicityService {
  /**
   * Check if a message is toxic
   * @param message - The message content to check
   * @param options - Optional configuration including examples and agentId
   * @returns Promise<ToxicityResult>
   */
  async checkToxicity(message: string, options?: ToxicityCheckOptions): Promise<ToxicityResult> {
    try {
      // Get AI configuration using the same system as aiService
      const aiConfig = await this.getAIConfig(options?.agentId)

      if (!aiConfig.apiKey) {
        console.warn('No AI connection configured for toxicity check, returning false')
        return { isToxic: false }
      }

      // Build the system prompt with examples
      const examplesText = options?.examples || 'No examples provided'
      const systemPrompt = `You are a content moderation assistant. Analyze the following conversation and determine if it is hostile or contains aggressive, threatening, or harmful content. Respond with 'true' or 'false' and no other words.

Examples of aggressive/hostile messages:
${examplesText}`

      const requestBody = {
        model: 'gpt-oss-120b',
        messages: [
          {
            role: 'assistant',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_completion_tokens: 1000,
        temperature: 0.3,
        top_p: 1,
        tool_choice: 'none'
      }

      const response = await fetch(`${aiConfig.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Toxicity API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log(data);

      // Parse the response - expecting 'true' or 'false' string
      const responseText = data.choices?.[0]?.message?.content?.trim().toLowerCase() || 'false'
      const isToxic = responseText === 'true'

      console.log('Toxicity check result:', { message: message.substring(0, 50), isToxic })

      return { isToxic }
    } catch (error: any) {
      console.error('Toxicity check error:', error)
      // Return false on error to avoid blocking workflow
      return { isToxic: false }
    }
  }

  /**
   * Get AI configuration using the same pattern as aiService
   * Uses agent's connection settings or falls back to default
   */
  private async getAIConfig(agentId?: string): Promise<{ apiKey: string; endpoint: string }> {
    try {
      if (agentId) {
        // Try to get agent-specific connection
        const Agent = (await import('~/server/models/Agent')).default
        const agent = await Agent.findById(agentId).lean() as any
        const connectionId = agent?.settings?.connectionId?.toString()

        if (connectionId) {
          const connections = await settingsService.getAllAIConnections()
          const connection = connections.find(conn => conn._id.toString() === connectionId && conn.isActive)
          if (connection) {
            return {
              apiKey: connection.apiKey,
              endpoint: connection.endpoint
            }
          }
        }
      }

      // Fall back to default connection
      const defaultConnection = await settingsService.getDefaultAIConnection()
      if (defaultConnection) {
        return {
          apiKey: defaultConnection.connection.apiKey,
          endpoint: defaultConnection.connection.endpoint
        }
      }

      throw new Error('No AI connections configured')
    } catch (error: any) {
      console.error('Failed to get AI config for toxicity check:', error.message)
      return { apiKey: '', endpoint: '' }
    }
  }
}

export default new ToxicityService()
