interface AISettings {
  temperature?: number
  maxTokens?: number
  responseDelay?: number
}

interface ContextDocument {
  type: 'file' | 'url'
  content: string
  filename?: string
  url?: string
}

class AIService {
  private apiKey: string
  private endpoint: string

  constructor() {
    this.apiKey = process.env.PREDICTION_GUARD_API_KEY || ''
    this.endpoint = process.env.PREDICTION_GUARD_ENDPOINT || 'https://api.predictionguard.com'
  }

  async generateResponse(
    prompt: string, 
    contextDocuments: ContextDocument[], 
    userMessage: string, 
    settings: AISettings = {}
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Prediction Guard API key not configured')
      }

      const systemPrompt = this.buildSystemPrompt(prompt, contextDocuments)
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]

      const requestBody = {
        model: 'Neural-Chat-7B',
        messages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.maxTokens || 500
      }

      console.log('Sending request to Prediction Guard:', {
        endpoint: this.endpoint,
        model: requestBody.model,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens
      })

      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Prediction Guard API error:', response.status, errorData)
        throw new Error(`AI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from AI API')
      }

      return data.choices[0].message.content

    } catch (error: any) {
      console.error('AI Service Error:', error)
      throw new Error(`Failed to generate AI response: ${error.message}`)
    }
  }

  private buildSystemPrompt(agentPrompt: string, contextDocuments: ContextDocument[]): string {
    let systemPrompt = agentPrompt

    if (contextDocuments && contextDocuments.length > 0) {
      systemPrompt += '\n\nAdditional Context:\n'
      contextDocuments.forEach(doc => {
        systemPrompt += `\n${doc.content}\n`
      })
    }

    return systemPrompt
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default new AIService() 