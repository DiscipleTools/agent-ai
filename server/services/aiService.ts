import settingsService from './settingsService'
import { ragService } from './ragService'

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
    agentId: string,
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

      // Use RAG to find relevant context instead of using all documents
      const systemPrompt = await this.buildSystemPromptWithRAG(agentId, prompt, userMessage, contextDocuments)
      
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
        messageCount: messages.length,
        systemPromptLength: systemPrompt.length
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

  private async buildSystemPromptWithRAG(
    agentId: string,
    prompt: string, 
    userMessage: string,
    contextDocuments: ContextDocument[]
  ): Promise<string> {
    let systemPrompt = prompt
    
    console.log(`\n🤖 Building system prompt for agent ${agentId}`)
    console.log(`📝 Base prompt length: ${prompt.length} characters`)
    console.log(`❓ User message: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`)

    try {
      // Check if RAG is available and agent has context documents
      const collectionInfo = await ragService.getCollectionInfo(agentId)
      
      if (collectionInfo.exists && (collectionInfo.pointsCount || 0) > 0) {
        console.log(`\n🔍 RAG System Active`)
        console.log(`📊 Total chunks in collection: ${collectionInfo.pointsCount}`)
        console.log(`🔎 Searching for relevant context...`)
        
        // Search for relevant chunks using RAG
        const relevantChunks = await ragService.searchRelevantChunks(
          agentId,
          userMessage,
          5 // Get top 5 most relevant chunks
        )

        if (relevantChunks.length > 0) {
          console.log(`\n✅ RAG Results Found: ${relevantChunks.length} relevant chunks`)
          console.log(`📋 RAG Articles/Sources Retrieved:`)
          
          // Log each found article/source with details
          relevantChunks.forEach((chunk, index) => {
            console.log(`   ${index + 1}. 📄 "${chunk.metadata.documentTitle}"`)
            console.log(`      📊 Relevance Score: ${chunk.score.toFixed(4)} (${(chunk.score * 100).toFixed(1)}%)`)
            console.log(`      📁 Type: ${chunk.metadata.documentType}`)
            console.log(`      🗂️  Chunk: ${chunk.metadata.chunkIndex + 1}`)
            if (chunk.metadata.language && chunk.metadata.language !== 'english') {
              console.log(`      🌐 Language: ${chunk.metadata.language}`)
            }
            if (chunk.metadata.source) {
              console.log(`      🔗 Source: ${chunk.metadata.source}`)
            }
            console.log(`      📝 Content preview: "${chunk.text.substring(0, 100)}${chunk.text.length > 100 ? '...' : ''}"`)
            console.log(`      📏 Content length: ${chunk.text.length} characters`)
          })
          
          systemPrompt += '\n\n=== RELEVANT CONTEXT ===\n'
          systemPrompt += 'Use the following relevant information to help answer the user\'s question:\n\n'
          
          relevantChunks.forEach((chunk, index) => {
            systemPrompt += `--- Context ${index + 1} (Score: ${chunk.score.toFixed(3)}) ---\n`
            systemPrompt += `Source: ${chunk.metadata.documentTitle}\n`
            if (chunk.metadata.language && chunk.metadata.language !== 'english') {
              systemPrompt += `Language: ${chunk.metadata.language}\n`
            }
            systemPrompt += `${chunk.text}\n\n`
          })
          
          systemPrompt += '=== END CONTEXT ===\n\n'
          systemPrompt += 'Use this context information to provide accurate, helpful responses. If the context doesn\'t contain relevant information for the user\'s question, use your general knowledge but mention that you don\'t have specific information about their query.'
          
          console.log(`\n📤 Final system prompt length: ${systemPrompt.length} characters`)
          console.log(`📈 Context added: ${systemPrompt.length - prompt.length} additional characters`)
        } else {
          console.log(`\n⚠️  RAG: No relevant chunks found (no articles matched the query)`)
          console.log(`🎯 Query did not match any stored context with sufficient relevance`)
          console.log(`🔄 Falling back to general knowledge`)
        }
      } else {
        console.log(`\n📂 RAG not available for this agent`)
        if (!collectionInfo.exists) {
          console.log(`❌ No RAG collection exists for agent ${agentId}`)
        } else {
          console.log(`📭 RAG collection exists but is empty (${collectionInfo.pointsCount || 0} chunks)`)
        }
        console.log(`🔄 Using traditional context documents instead`)
        
        // Fallback to traditional context document concatenation if RAG is not available
        if (contextDocuments && contextDocuments.length > 0) {
          console.log(`📋 Traditional context documents: ${contextDocuments.length} documents`)
          contextDocuments.forEach((doc, index) => {
            console.log(`   ${index + 1}. 📄 ${doc.filename || doc.url || `Document ${index + 1}`} (${doc.type})`)
            console.log(`      📏 Content length: ${doc.content.length} characters`)
          })
          
          systemPrompt += '\n\nAdditional Context:\n'
          contextDocuments.forEach((doc, index) => {
            systemPrompt += `\n--- Document ${index + 1} ---\n`
            if (doc.filename) systemPrompt += `File: ${doc.filename}\n`
            if (doc.url) systemPrompt += `URL: ${doc.url}\n`
            systemPrompt += `${doc.content}\n`
          })
          
          console.log(`📤 Final system prompt length: ${systemPrompt.length} characters`)
          console.log(`📈 Context added: ${systemPrompt.length - prompt.length} additional characters`)
        } else {
          console.log(`📭 No traditional context documents available either`)
        }
      }
    } catch (ragError) {
      console.error(`\n❌ RAG processing failed:`, ragError)
      console.log(`🔄 Falling back to traditional context documents`)
      
      // Fallback to traditional context documents
      if (contextDocuments && contextDocuments.length > 0) {
        console.log(`📋 Fallback: Using ${contextDocuments.length} traditional context documents`)
        contextDocuments.forEach((doc, index) => {
          console.log(`   ${index + 1}. 📄 ${doc.filename || doc.url || `Document ${index + 1}`} (${doc.type})`)
          console.log(`      📏 Content length: ${doc.content.length} characters`)
        })
        
        systemPrompt += '\n\nAdditional Context:\n'
        contextDocuments.forEach((doc, index) => {
          systemPrompt += `\n--- Document ${index + 1} ---\n`
          if (doc.filename) systemPrompt += `File: ${doc.filename}\n`
          if (doc.url) systemPrompt += `URL: ${doc.url}\n`
          systemPrompt += `${doc.content}\n`
        })
        
        console.log(`📤 Final system prompt length: ${systemPrompt.length} characters`)
        console.log(`📈 Context added: ${systemPrompt.length - prompt.length} additional characters`)
      } else {
        console.log(`📭 No fallback context documents available`)
      }
    }

    // Log the complete system prompt (truncated for readability)
    console.log(`\n📋 Complete System Prompt Preview:`)
    console.log(`${'='.repeat(60)}`)
    if (systemPrompt.length <= 500) {
      console.log(systemPrompt)
    } else {
      console.log(systemPrompt.substring(0, 400))
      console.log(`\n... [TRUNCATED - showing first 400 chars of ${systemPrompt.length} total] ...`)
      console.log(systemPrompt.substring(systemPrompt.length - 100))
    }
    console.log(`${'='.repeat(60)}\n`)

    return systemPrompt
  }

  // Legacy method signature for backward compatibility
  async generateResponseLegacy(
    prompt: string, 
    contextDocuments: ContextDocument[], 
    userMessage: string, 
    settings: AISettings = {}
  ): Promise<string> {
    // For backward compatibility, create a temporary agent ID
    const tempAgentId = 'legacy_' + Date.now()
    return this.generateResponse(tempAgentId, prompt, contextDocuments, userMessage, settings)
  }

  delay(ms: number): Promise<void> {
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
        'test_connection_agent',
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