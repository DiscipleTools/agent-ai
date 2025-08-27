/**
 * This service handles all interactions with AI models.
 * It is responsible for generating AI responses, managing AI configurations,
 * and testing connections. It is used by various API endpoints, including:
 * 
 * - POST /api/webhook/agent/[id]
 * - POST /api/webhook/agent/[id]/chat
 * - POST /api/settings/ai-connections
 * - PUT /api/settings/ai-connections/[id]
 * - POST /api/settings/ai-connections/[id]/refresh-models
 * - GET /api/rag/test-connection
 */
import { sanitizePrompt } from '~/utils/sanitize.js'
import settingsService from './settingsService'
import { ragService } from './ragService'
import Agent from '~/server/models/Agent'

interface ContextDocument {
  type: 'file' | 'url' | 'website'
  content: string
  filename?: string
  url?: string
}

interface AISettings {
  temperature?: number
  maxTokens?: number
  responseDelay?: number
  connectionId?: string  // Allow specifying a specific connection
  modelId?: string       // Allow specifying a specific model
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
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
    agentId: string,
    prompt: string, 
    contextDocuments: ContextDocument[], 
    userMessage: string, 
    settings: AISettings = {},
    conversationHistory: OpenAIMessage[] = []
  ): Promise<string> {
    try {
      // Sanitize user-provided input to mitigate prompt injection
      const sanitizedUserMessage = sanitizePrompt(userMessage)
      const sanitizedConversationHistory = conversationHistory.map(message => {
        if (message.role === 'user') {
          return { ...message, content: sanitizePrompt(message.content) }
        }
        return message
      })

      // Get AI connection and model to use
      const aiConfig = await this.getAIConfig(agentId)

      if (!aiConfig.apiKey) {
        throw new Error('No AI connection configured. Please set up an AI connection in Settings.')
      }

      // Use RAG to find relevant context instead of using all documents
      const systemPrompt = await this.buildSystemPromptWithRAG(agentId, prompt, sanitizedUserMessage, contextDocuments)
      
      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...sanitizedConversationHistory,
        { role: 'user', content: sanitizedUserMessage }
      ]

      const generatedContent = await this.executeAICall(aiConfig, messages, settings)

      if (!generatedContent || generatedContent.trim().length === 0) {
        throw new Error('Empty response content from AI API')
      }

      console.log('AI response generated successfully:', {
        contentLength: generatedContent.length
      })

      return generatedContent.trim()

    } catch (error: any) {
      console.error('AI Service Error:', {
        message: error.message,
        stack: error.stack
      })
      
      // Provide more specific error messages
      if (error.message.includes('401')) {
        throw new Error('Invalid API key. Please check your AI connection settings.')
      } else if (error.message.includes('403')) {
        throw new Error('Access denied to AI API. Please check your API key permissions.')
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded for AI API. Please try again later.')
      } else if (error.message.includes('500')) {
        throw new Error('AI API server error. Please try again later.')
      }
      
      throw new Error(`Failed to generate AI response: ${error.message}`)
    }
  }

  private async executeAICall(
    aiConfig: { apiKey: string; endpoint: string; model: string },
    messages: OpenAIMessage[],
    settings: { temperature?: number, max_tokens?: number }
  ): Promise<string> {
    const requestBody: any = {
      model: aiConfig.model,
      messages
    }

    // Handle temperature restrictions for newer models
    if (aiConfig.model.includes('gpt-5') || aiConfig.model.includes('o1')) {
      // GPT-5 and o1 models only support default temperature (1)
      requestBody.temperature = 1
    } else {
      requestBody.temperature = settings.temperature || 0.3
    }

    // Use max_completion_tokens for GPT-4o and newer models, max_tokens for older models
    const maxTokens = settings.max_tokens || 500
    if (aiConfig.model.includes('gpt-4o') || aiConfig.model.includes('gpt-5') || aiConfig.model.includes('o1')) {
      requestBody.max_completion_tokens = maxTokens
    } else {
      requestBody.max_tokens = maxTokens
    }

    console.log('Sending request to AI service:', {
      endpoint: `${aiConfig.endpoint}/chat/completions`,
      model: requestBody.model,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens || requestBody.max_completion_tokens,
      messageCount: messages.length
    })

    const response = await fetch(`${aiConfig.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.text()
        console.error('AI API error response:', errorData)
        errorMessage = `${errorMessage} - ${errorData}`
      } catch (parseError) {
        console.error('Could not parse error response:', parseError)
      }
      throw new Error(`AI API error: ${errorMessage}`)
    }

    const data: OpenAIResponse = await response.json()
    
    console.log('AI API response:', {
      id: data.id,
      model: data.model,
      usage: data.usage,
      choicesCount: data.choices?.length || 0
    })

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response format from AI API:', data)
      throw new Error('Invalid response format from AI API - missing choices or message')
    }

    return data.choices[0].message.content
  }

  private async getAIConfig(agentId: string): Promise<{ apiKey: string; endpoint: string; model: string }> {
    const agent = await Agent.findById(agentId).lean() as any
    const connectionId = agent?.settings?.connectionId?.toString()
    const modelId = agent?.settings?.modelId
    return this.getRequestedModel(connectionId, modelId)
  }

  // Get a specific model's configuration details
  private async getRequestedModel(connectionId?: string, modelId?: string): Promise<{ apiKey: string; endpoint: string; model: string }> {
    try {
      // If specific connection and model requested, try to find it
      if (connectionId && modelId) {
        const connections = await settingsService.getAllAIConnections()
        const connection = connections.find(conn => conn._id.toString() === connectionId && conn.isActive)
        if (connection) {
          const model = connection.availableModels.find(m => m.id === modelId && m.enabled)
          if (model) {
            return {
              apiKey: connection.apiKey,
              endpoint: connection.endpoint,
              model: model.id
            }
          }
        }
        console.log(`❌ Connection "${connectionId}" or model "${modelId}" not found`)
        console.log(`🔄 Falling back to system default`)
      }

      // Try to get default connection
      const defaultConnection = await settingsService.getDefaultAIConnection()
      if (defaultConnection) {
        return {
          apiKey: defaultConnection.connection.apiKey,
          endpoint: defaultConnection.connection.endpoint,
          model: defaultConnection.modelId
        }
      }

      // No connections available
      throw new Error('No AI connections configured. Please add an AI connection in Settings.')

    } catch (error: any) {
      console.error('Failed to get AI config:', error.message)
      throw new Error('No AI connections configured. Please add an AI connection in Settings.')
    }
  }

  // Get connection configuration for fetching all models
  private async getConnectionForModels(connectionId?: string): Promise<{ apiKey: string; endpoint: string; model: string }> {
    try {
      // If specific connection requested, try to find it
      if (connectionId) {
        const connections = await settingsService.getAllAIConnections()
        const connection = connections.find(conn => conn._id.toString() === connectionId && conn.isActive)
        if (connection) {
          // For model fetching purposes, return connection config even without specific model
          if (connection.availableModels.length > 0) {
            const model = connection.availableModels.find(m => m.enabled) || connection.availableModels[0]
            return {
              apiKey: connection.apiKey,
              endpoint: connection.endpoint,
              model: model.id
            }
          } else {
            // For new connections without models, return a default model name
            return {
              apiKey: connection.apiKey,
              endpoint: connection.endpoint,
              model: 'default' // Temporary placeholder for model fetching
            }
          }
        }
        console.log(`❌ Connection "${connectionId}" not found or inactive`)
      }

      // Try to get default connection
      const defaultConnection = await settingsService.getDefaultAIConnection()
      if (defaultConnection) {
        return {
          apiKey: defaultConnection.connection.apiKey,
          endpoint: defaultConnection.connection.endpoint,
          model: defaultConnection.modelId
        }
      }

      // No connections available
      throw new Error('No AI connections configured. Please add an AI connection in Settings.')

    } catch (error: any) {
      console.error('Failed to get AI config:', error.message)
      throw new Error('No AI connections configured. Please add an AI connection in Settings.')
    }
  }

  private async buildSystemPromptWithRAG(
    agentId: string,
    prompt: string, 
    userMessage: string,
    contextDocuments: ContextDocument[]
  ): Promise<string> {
    let systemPrompt = prompt

    try {
      // Check if RAG is available and agent has context documents
      const collectionInfo = await ragService.getCollectionInfo(agentId)
      
      if (collectionInfo.exists && (collectionInfo.pointsCount || 0) > 0) {
        // Search for relevant chunks using RAG
        const relevantChunks = await ragService.searchRelevantChunks(
          agentId,
          userMessage,
          5 // Get top 5 most relevant chunks
        )

        if (relevantChunks.length > 0) {
          systemPrompt += '\n\n=== RELEVANT CONTEXT ===\n'
          
          relevantChunks.forEach((chunk, index) => {
            const source = chunk.metadata.source || chunk.metadata.documentTitle;
            systemPrompt += `--- Context ${index + 1} (Score: ${chunk.score.toFixed(3)}) ---\n`;
            systemPrompt += `Source: ${source}\n`;
            if (chunk.metadata.language && chunk.metadata.language !== 'english') {
              systemPrompt += `Language: ${chunk.metadata.language}\n`;
            }
            systemPrompt += `${chunk.text}\n\n`;
          });
          
          systemPrompt += '=== END CONTEXT ===\n\n'
        }
      } else {
        // Fallback to traditional context document concatenation if RAG is not available
        systemPrompt = this.appendContextDocuments(systemPrompt, contextDocuments)
      }
    } catch (ragError) {
      // Fallback to traditional context documents
      systemPrompt = this.appendContextDocuments(systemPrompt, contextDocuments)
    }

    return systemPrompt
  }

  private appendContextDocuments(systemPrompt: string, contextDocuments: ContextDocument[]): string {
    if (contextDocuments && contextDocuments.length > 0) {
      systemPrompt += '\n\nAdditional Context:\n'
      contextDocuments.forEach((doc, index) => {
        systemPrompt += `\n--- Document ${index + 1} ---\n`
        if (doc.filename) systemPrompt += `File: ${doc.filename}\n`
        if (doc.url) systemPrompt += `URL: ${doc.url}\n`
        systemPrompt += `${doc.content}\n`
      })
    }
    return systemPrompt
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Method to get available models for a specific connection
  async getAvailableModels(connectionId?: string): Promise<string[]> {
    try {
      const aiConfig = await this.getConnectionForModels(connectionId)
      
      if (!aiConfig.apiKey) {
        return [aiConfig.model] // Return default model if no API key
      }

      // Different endpoints for different providers
      let modelsEndpoint = `${aiConfig.endpoint}/models`
      
      // For Prediction Guard, use specific endpoint
      if (aiConfig.endpoint.includes('predictionguard.com')) {
        modelsEndpoint = `${aiConfig.endpoint}/models/chat-completion`
      }

      const response = await fetch(modelsEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Handle different response formats
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((model: any) => model.id || model.model || model.name).filter(Boolean)
      } else if (Array.isArray(data)) {
        return data.map((model: any) => model.id || model.model || model.name).filter(Boolean)
      }
      
      return [aiConfig.model] // Return default model as fallback
    } catch (error: any) {
      console.error('Failed to fetch available models:', error)
      const aiConfig = await this.getConnectionForModels(connectionId)
      return [aiConfig.model] // Return default model as fallback
    }
  }
}

export default new AIService() 