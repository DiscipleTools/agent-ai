import settingsService from './settingsService'

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

interface PredictionGuardMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface PredictionGuardResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

class AIService {
  async generateResponse(
    prompt: string, 
    contextDocuments: ContextDocument[], 
    userMessage: string, 
    settings: AISettings = {}
  ): Promise<string> {
    try {
      // Get configuration from settings service (database first, then environment)
      const config = await settingsService.getPredictionGuardConfig()

      if (!config.apiKey) {
        throw new Error('Prediction Guard API key not configured. Please set it in Settings or PREDICTION_GUARD_API_KEY environment variable.')
      }

      const systemPrompt = this.buildSystemPrompt(prompt, contextDocuments)
      const messages: PredictionGuardMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]

      const requestBody = {
        model: config.model,
        messages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.maxTokens || 500
      }

      console.log('Sending request to Prediction Guard:', {
        endpoint: `${config.endpoint}/chat/completions`,
        model: requestBody.model,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
        messageCount: messages.length
      })

      const response = await fetch(`${config.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.text()
          console.error('Prediction Guard API error response:', errorData)
          errorMessage = `${errorMessage} - ${errorData}`
        } catch (parseError) {
          console.error('Could not parse error response:', parseError)
        }
        throw new Error(`Prediction Guard API error: ${errorMessage}`)
      }

      const data: PredictionGuardResponse = await response.json()
      
      console.log('Prediction Guard API response:', {
        id: data.id,
        model: data.model,
        usage: data.usage,
        choicesCount: data.choices?.length || 0
      })

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid response format from Prediction Guard API:', data)
        throw new Error('Invalid response format from Prediction Guard API - missing choices or message')
      }

      const generatedContent = data.choices[0].message.content

      if (!generatedContent || generatedContent.trim().length === 0) {
        throw new Error('Empty response content from Prediction Guard API')
      }

      console.log('AI response generated successfully:', {
        contentLength: generatedContent.length,
        tokensUsed: data.usage?.total_tokens || 'unknown'
      })

      return generatedContent.trim()

    } catch (error: any) {
      console.error('AI Service Error:', {
        message: error.message,
        stack: error.stack
      })
      
      // Provide more specific error messages
      if (error.message.includes('401')) {
        throw new Error('Invalid Prediction Guard API key. Please check your API key in Settings.')
      } else if (error.message.includes('403')) {
        throw new Error('Access denied to Prediction Guard API. Please check your API key permissions.')
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded for Prediction Guard API. Please try again later.')
      } else if (error.message.includes('500')) {
        throw new Error('Prediction Guard API server error. Please try again later.')
      }
      
      throw new Error(`Failed to generate AI response: ${error.message}`)
    }
  }

  private buildSystemPrompt(agentPrompt: string, contextDocuments: ContextDocument[]): string {
    let systemPrompt = agentPrompt

    if (contextDocuments && contextDocuments.length > 0) {
      systemPrompt += '\n\nAdditional Context:\n'
      contextDocuments.forEach((doc, index) => {
        systemPrompt += `\n--- Context Document ${index + 1} ---\n`
        if (doc.filename) {
          systemPrompt += `Source: ${doc.filename}\n`
        }
        if (doc.url) {
          systemPrompt += `URL: ${doc.url}\n`
        }
        systemPrompt += `${doc.content}\n`
      })
      systemPrompt += '\n--- End of Context Documents ---\n'
    }

    return systemPrompt
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Method to test API connectivity
  async testConnection(): Promise<{ success: boolean; message: string; model?: string; endpoint?: string }> {
    try {
      const config = await settingsService.getPredictionGuardConfig()
      
      if (!config.apiKey) {
        return { 
          success: false, 
          message: 'API key not configured in Settings or environment variables',
          endpoint: config.endpoint
        }
      }

      const testResponse = await this.generateResponse(
        'You are a helpful assistant.',
        [],
        'Say "Hello, I am working!" and nothing else.',
        { temperature: 0.1, maxTokens: 50 }
      )

      return { 
        success: true, 
        message: 'Connection successful', 
        model: config.model,
        endpoint: config.endpoint
      }
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message 
      }
    }
  }

  // Method to get available models (for future use)
  async getAvailableModels(): Promise<string[]> {
    try {
      const config = await settingsService.getPredictionGuardConfig()
      
      if (!config.apiKey) {
        return [config.model] // Return default model if no API key
      }

      const response = await fetch(`${config.endpoint}/models/chat-completion`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.data?.map((model: any) => model.id) || [config.model]
    } catch (error: any) {
      console.error('Failed to fetch available models:', error)
      const config = await settingsService.getPredictionGuardConfig()
      return [config.model] // Return default model as fallback
    }
  }
}

export default new AIService() 