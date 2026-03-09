/**
 * Toxicity Detection Service
 *
 * This service handles toxicity detection for messages using the AI service.
 * It uses user-provided examples to classify hostile/toxic content.
 * Uses the same AI connection system as the main AI service.
 */

import aiService from './aiService'

interface ToxicityResult {
  isToxic: boolean
}

interface ToxicityCheckOptions {
  examples?: string
}

class ToxicityService {
  /**
   * Check if a message is toxic
   * @param message - The message content to check
   * @param options - Optional configuration including examples
   * @returns Promise<ToxicityResult>
   */
  async checkToxicity(message: string, options?: ToxicityCheckOptions): Promise<ToxicityResult> {
    try {
      // Build the system prompt with examples
      const examplesText = options?.examples || 'No examples provided'
      const systemPrompt = `You are a content moderation assistant. Analyze the following message and determine if it is hostile or contains aggressive, threatening, or harmful content. Respond with 'true' or 'false' and no other words.

Examples of aggressive/hostile messages:
${examplesText}`

      // Use aiService to generate response with the default model
      const responseText = await aiService.generateSimpleResponse(systemPrompt, message)

      // Parse the response - expecting 'true' or 'false' string
      const isToxic = responseText.toLowerCase().trim() === 'true'

      console.log('Toxicity check result:', { message: message.substring(0, 50), isToxic })

      return { isToxic }
    } catch (error: any) {
      console.error('Toxicity check error:', error)
      // Return false on error to avoid blocking workflow
      return { isToxic: false }
    }
  }

}

export default new ToxicityService()
