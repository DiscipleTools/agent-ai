/**
 * RAG (Retrieval-Augmented Generation) Service
 * 
 * This service handles the processing, storage, and retrieval of document chunks for AI agents.
 * It provides semantic search capabilities using vector embeddings stored in Qdrant database.
 * 
 * Key Features:
 * - Multilingual text embedding using Xenova/all-MiniLM-L12-v2 model
 * - Document chunking with configurable overlap for optimal context
 * - Vector storage and similarity search via Qdrant
 * - Support for multiple document types (files, URLs, websites)
 * - Language detection and preprocessing for improved search relevance
 * - Batch processing with connection resilience and timeout handling
 * 
 * Document Processing Flow:
 * 1. Text content is cleaned and chunked into manageable pieces
 * 2. Each chunk is converted to a vector embedding
 * 3. Embeddings are stored in Qdrant with metadata
 * 4. Search queries are embedded and matched against stored vectors
 * 5. Most relevant chunks are returned with similarity scores
 */

import { pipeline } from '@xenova/transformers'
import type { Pipeline } from '@xenova/transformers'
import crypto from 'crypto'
import { 
  sanitizeContent, 
  sanitizeSearchQuery, 
  sanitizeUrl, 
  sanitizeText,
  sanitizeErrorMessage,
  sanitizeNumber
} from '~/utils/sanitize.js'

interface ChunkData {
  id: string
  text: string
  metadata: {
    agentId: string
    documentId: string
    documentType: 'file' | 'url' | 'website'
    documentTitle: string
    chunkIndex: number
    language?: string
    source?: string
  }
}

interface SearchResult {
  text: string
  score: number
  metadata: ChunkData['metadata']
}

interface QdrantPoint {
  id: string
  vector: number[]
  payload: ChunkData['metadata'] & { text: string; originalId: string }
}

class RAGService {
  private embeddingModel: any = null
  private qdrantUrl: string
  private modelName = 'Xenova/all-MiniLM-L12-v2' // Multilingual model
  private isInitialized = false

  constructor() {
    this.qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'
  }

  private async initializeEmbeddingModel(): Promise<void> {
    if (!this.embeddingModel) {
      this.embeddingModel = await pipeline('feature-extraction', this.modelName, {
        quantized: false,
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            console.log(`Downloading model: ${progress.name} - ${progress.progress?.toFixed(1)}%`)
          }
        }
      })
      console.log('✅ Multilingual embedding model loaded successfully')
    }
  }

  private async ensureCollectionExists(agentId: string): Promise<void> {
    const collectionName = `agent_${agentId}`
    
    try {
      // Add timeout for Qdrant requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      // Check if collection exists
      const response = await fetch(`${this.qdrantUrl}/collections/${collectionName}`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.status === 404) {
        // Create collection
        console.log(`Creating Qdrant collection for agent: ${agentId}`)
        
        const createController = new AbortController()
        const createTimeoutId = setTimeout(() => createController.abort(), 15000) // 15 second timeout for creation
        
        const createResponse = await fetch(`${this.qdrantUrl}/collections/${collectionName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vectors: {
              size: 384, // all-MiniLM-L12-v2 embedding size
              distance: 'Cosine'
            },
            optimizers_config: {
              default_segment_number: 2
            },
            replication_factor: 1
          }),
          signal: createController.signal
        })
        
        clearTimeout(createTimeoutId)

        if (!createResponse.ok) {
          const error = await createResponse.text()
          const sanitizedError = sanitizeErrorMessage(error)
          throw new Error(`Failed to create Qdrant collection: ${sanitizedError}`)
        }
        console.log(`✅ Collection ${collectionName} created successfully`)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Qdrant connection timeout - please check if Qdrant is running and accessible')
      }
      console.error('Error ensuring collection exists:', error)
      throw error
    }
  }

  private chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
    // Sanitize and validate chunk parameters to prevent resource exhaustion
    const sanitizedChunkSize = Math.max(50, Math.min(2000, sanitizeNumber(chunkSize)))
    const sanitizedOverlap = Math.max(0, Math.min(sanitizedChunkSize - 1, sanitizeNumber(overlap)))
    
    const words = text.split(/\s+/)
    const chunks: string[] = []
    
    for (let i = 0; i < words.length; i += sanitizedChunkSize - sanitizedOverlap) {
      const chunk = words.slice(i, i + sanitizedChunkSize).join(' ')
      if (chunk.trim()) {
        chunks.push(chunk.trim())
      }
    }
    
    return chunks.length > 0 ? chunks : [text]
  }

  private chunkWebsiteContent(content: string): { chunks: string[]; pageUrls: string[] } {
    const chunks: string[] = []
    const pageUrls: string[] = []
    
    // Split content by page sections
    const sections = content.split(/--- Page \d+:.*? ---\n/)
    
    for (let i = 1; i < sections.length; i++) { // Skip first section (summary)
      const section = sections[i]
      
      // Extract URL from the section
      const urlMatch = section.match(/^URL: (https?:\/\/[^\n]+)/m)
      const pageUrl = urlMatch ? sanitizeUrl(urlMatch[1]) : ''
      
      // Get the content after the URL line
      const contentStart = section.indexOf('\n') + 1
      let pageContent = section.substring(contentStart).trim()
      
      if (pageContent) {
        // Sanitize page content before processing
        pageContent = sanitizeContent(pageContent)
        
        // Preprocess content to reduce brand name pollution
        pageContent = this.preprocessTextForEmbedding(pageContent)
        
        // Chunk this page's content
        const pageChunks = this.chunkText(pageContent)
        
        // Add page context to each chunk for better search relevance
        for (const chunk of pageChunks) {
          chunks.push(chunk)
          pageUrls.push(pageUrl)
        }
      }
    }
    
    return { chunks, pageUrls }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingModel) {
      await this.initializeEmbeddingModel()
    }

    try {
      const result = await this.embeddingModel!(text, { pooling: 'mean', normalize: true })
      return Array.from(result.data)
    } catch (error) {
      console.error('Error generating embedding:', error)
      throw new Error('Failed to generate embedding')
    }
  }

  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    // You could integrate a proper language detection library here
    const sample = text.substring(0, 200).toLowerCase()
    
    // Common patterns for different languages
    if (/[àáâãäåçèéêëìíîïñòóôõöùúûüý]/.test(sample)) return 'romance' // French, Spanish, Portuguese, Italian
    if (/[äöüß]/.test(sample)) return 'german'
    if (/[а-я]/.test(sample)) return 'russian'
    if (/[αβγδεζηθικλμνξοπρστυφχψω]/.test(sample)) return 'greek'
    if (/[一-龯]/.test(sample)) return 'chinese'
    if (/[ひらがなカタカナ]/.test(sample)) return 'japanese'
    if (/[가-힣]/.test(sample)) return 'korean'
    if (/[اأإآؤئبتثجحخدذرزسشصضطظعغفقكلمنهوي]/.test(sample)) return 'arabic'
    
    return 'english' // default
  }

  /**
   * Preprocess text to reduce brand name pollution and improve semantic relevance
   */
  private preprocessTextForEmbedding(text: string): string {
    // Clean up excessive whitespace
    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  async processDocument(agentId: string, documentId: string, content: string, metadata: {
    type: 'file' | 'url' | 'website'
    title: string
    source?: string
  }): Promise<{ chunksCreated: number; collectionName: string }> {
    try {
      console.log(`Processing document ${documentId} for agent ${agentId}`)
      
      await this.ensureCollectionExists(agentId)
      
      // Small delay to ensure Qdrant is fully ready (especially after deletions)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Sanitize inputs to prevent injection attacks
      const sanitizedContent = sanitizeContent(content)
      const sanitizedTitle = sanitizeText(metadata.title)
      const sanitizedSource = metadata.source ? sanitizeUrl(metadata.source) : undefined
      
      // Clean and chunk the content
      const cleanContent = sanitizedContent.replace(/\s+/g, ' ').trim()
      let chunks: string[] = []
      let chunkPageUrls: string[] = []
      
              // For website documents, extract page-specific URLs for each chunk
        if (metadata.type === 'website' && sanitizedContent.includes('=== WEBSITE CONTENT ===')) {
          const { chunks: websiteChunks, pageUrls } = this.chunkWebsiteContent(sanitizedContent)
          chunks = websiteChunks
          chunkPageUrls = pageUrls
        } else {
          chunks = this.chunkText(cleanContent)
          chunkPageUrls = new Array(chunks.length).fill(sanitizedSource || '')
        }
      
      const language = this.detectLanguage(cleanContent)
      
      console.log(`Created ${chunks.length} chunks from document`)
      
      // Generate embeddings and prepare points
      const points: QdrantPoint[] = []
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = await this.generateEmbedding(chunk)
        
        const point: QdrantPoint = {
          id: crypto.randomUUID(),
          vector: embedding,
          payload: {
            text: chunk,
            agentId,
            documentId,
            documentType: metadata.type,
            documentTitle: sanitizedTitle,
            chunkIndex: i,
            language,
            source: chunkPageUrls[i] || sanitizedSource,
            originalId: `${documentId}_chunk_${i}`
          }
        }
        
        points.push(point)
      }
      
      // Batch insert to Qdrant with chunking to avoid EPIPE errors
      const collectionName = `agent_${agentId}`
      const batchSize = 10 // Insert 10 chunks at a time to avoid large payloads
      
      console.log(`📊 Starting batch insertion: ${points.length} points, ${Math.ceil(points.length/batchSize)} batches`)
      
      // Robust health check before starting batch processing (with retries for post-deletion scenarios)
      let healthCheckPassed = false
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const healthCheck = await this.healthCheck()
          
          if (healthCheck.qdrantConnected) {
            healthCheckPassed = true
            break
          } else {
            console.log(`❌ Health check failed on attempt ${attempt}: ${healthCheck.error}`)
          }
        } catch (healthError) {
          console.log(`❌ Health check error on attempt ${attempt}:`, healthError)
        }
        
        // Wait between attempts (longer waits for later attempts)
        if (attempt < 5) {
          const waitTime = attempt * 1000 // 1s, 2s, 3s, 4s
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
      
      if (!healthCheckPassed) {
        throw new Error(`Cannot proceed with insertion - Qdrant health check failed after 5 attempts. Please verify Qdrant is running at ${this.qdrantUrl}`)
      }
      
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize)
        
        // Validate batch before sending
        for (const point of batch) {
          if (!point.id || !point.vector || !Array.isArray(point.vector) || point.vector.length !== 384) {
            console.error('Invalid point structure:', { 
              id: !!point.id, 
              hasVector: !!point.vector, 
              vectorLength: point.vector?.length 
            })
            throw new Error(`Invalid point structure in batch ${Math.floor(i/batchSize) + 1}`)
          }
        }
        
        try {
          // Add timeout for Qdrant connection
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout for larger batches
          
          const insertResponse = await fetch(`${this.qdrantUrl}/collections/${collectionName}/points`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Connection': 'keep-alive' // Try to maintain connection
            },
            body: JSON.stringify({
              points: batch
            }),
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (!insertResponse.ok) {
            const error = await insertResponse.text()
            const sanitizedError = sanitizeErrorMessage(error)
            throw new Error(`Failed to insert batch ${Math.floor(i/batchSize) + 1}: ${sanitizedError}`)
          }
          
          // Small delay between batches to avoid overwhelming Qdrant
          if (i + batchSize < points.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          
        } catch (error: any) {
          console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, {
            error: error.message,
            cause: error.cause?.message || 'No cause',
            code: error.cause?.code || 'No code',
            qdrantUrl: this.qdrantUrl,
            batchSize: batch.length
          })
          
          if (error.name === 'AbortError') {
            throw new Error(`Qdrant connection timeout on batch ${Math.floor(i/batchSize) + 1} - please check Qdrant performance`)
          }
          
          // If it's a connection error, try to check Qdrant health first
          if (error.message.includes('fetch failed') || error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'EPIPE') {
            try {
              const healthCheck = await this.healthCheck()
              if (!healthCheck.qdrantConnected) {
                throw new Error(`Qdrant is not accessible at ${this.qdrantUrl}. Please check if Qdrant container is running and accessible.`)
              }
            } catch (healthError) {
              throw new Error(`Qdrant connection failed. Health check error: ${healthError instanceof Error ? healthError.message : 'Unknown error'}`)
            }
          }
          
          throw new Error(`Failed to insert batch ${Math.floor(i/batchSize) + 1}: ${error.message}`)
        }
      }
      
      console.log(`✅ Successfully processed document ${documentId}: ${chunks.length} chunks`)
      
      return {
        chunksCreated: chunks.length,
        collectionName
      }
    } catch (error) {
      console.error('Error processing document:', error)
      throw error
    }
  }

  async searchRelevantChunks(
    agentId: string, 
    query: string, 
    limit: number = 5,
    filters?: { documentType?: string; language?: string }
  ): Promise<SearchResult[]> {
    try {
      const collectionName = `agent_${agentId}`
      
      // Sanitize and validate inputs
      const sanitizedQuery = sanitizeSearchQuery(query)
      if (!sanitizedQuery) {
        console.warn('Empty or invalid search query after sanitization')
        return []
      }
      
      // Validate and clamp limit to prevent resource exhaustion
      const sanitizedLimit = Math.max(1, Math.min(100, Math.floor(limit)))
      
      // Sanitize filter values if provided
      const sanitizedFilters: { documentType?: string; language?: string } = {}
      if (filters?.documentType) {
        const docType = sanitizeText(filters.documentType)
        if (['file', 'url', 'website'].includes(docType)) {
          sanitizedFilters.documentType = docType
        }
      }
      if (filters?.language) {
        sanitizedFilters.language = sanitizeText(filters.language)
      }
      
      // Preprocess query to focus on meaningful terms
      const processedQuery = this.preprocessQuery(sanitizedQuery)
      console.log(`🔍 Query preprocessing: "${sanitizedQuery}" → "${processedQuery}"`)
      
      // Generate query embedding with processed text
      const queryEmbedding = await this.generateEmbedding(processedQuery)
      
      // Build filter conditions
      const filterConditions: any[] = [
        { key: 'agentId', match: { value: agentId } }
      ]
      
      if (sanitizedFilters.documentType) {
        filterConditions.push({ key: 'documentType', match: { value: sanitizedFilters.documentType } })
      }
      
      if (sanitizedFilters.language) {
        filterConditions.push({ key: 'language', match: { value: sanitizedFilters.language } })
      }
      
      // Search in Qdrant
      const searchResponse = await fetch(`${this.qdrantUrl}/collections/${collectionName}/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector: queryEmbedding,
          limit: sanitizedLimit,
          with_payload: true,
          filter: filterConditions.length > 0 ? { must: filterConditions } : undefined
        })
      })
      
      if (!searchResponse.ok) {
        const error = await searchResponse.text()
        const sanitizedError = sanitizeErrorMessage(error)
        throw new Error(`Qdrant search failed: ${sanitizedError}`)
      }
      
      const searchResults = await searchResponse.json()
      
      // Transform results and apply page type boost
      const results: SearchResult[] = searchResults.result.map((hit: any) => {
        return {
          text: hit.payload.text,
          score: hit.score,
          metadata: {
            agentId: hit.payload.agentId,
            documentId: hit.payload.documentId,
            documentType: hit.payload.documentType,
            documentTitle: hit.payload.documentTitle,
            chunkIndex: hit.payload.chunkIndex,
            language: hit.payload.language,
            source: hit.payload.source
          }
        }
      })
      
      // Re-sort by boosted scores
      results.sort((a, b) => b.score - a.score)
      
      console.log(`Found ${results.length} relevant chunks for query: "${sanitizedQuery.substring(0, 50)}..."`)
      
      return results
    } catch (error) {
      console.error('Error searching relevant chunks:', error)
      return []
    }
  }

  /**
   * Preprocess search queries to focus on meaningful terms and reduce noise
   */
  private preprocessQuery(query: string): string {
    // Common stop words that don't add semantic value for search
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'how', 'where', 'what', 'when', 'why', 'who', 'which', 'this', 'that', 'these', 'those',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must'
    ])
    
    // Extract meaningful words
    const words = query.toLowerCase().split(/\s+/)
    const meaningfulWords = words.filter(word => {
      const cleanWord = word.replace(/[^\w]/g, '')
      return cleanWord.length > 2 && !stopWords.has(cleanWord)
    })
    
    // If we filtered out too much, keep the original query
    if (meaningfulWords.length === 0) {
      return query
    }
    
    return meaningfulWords.join(' ')
  }

  async deleteDocumentChunks(agentId: string, documentId: string): Promise<void> {
    try {
      const collectionName = `agent_${agentId}`
      
      // Check if collection exists first
      const collectionInfo = await this.getCollectionInfo(agentId)
      if (!collectionInfo.exists) {
        console.log(`📝 Collection ${collectionName} doesn't exist yet - no chunks to delete`)
        return
      }
      
      // Delete all points with this documentId
      const deleteResponse = await fetch(`${this.qdrantUrl}/collections/${collectionName}/points/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [
              { key: 'agentId', match: { value: agentId } },
              { key: 'documentId', match: { value: documentId } }
            ]
          }
        })
      })
      
      if (!deleteResponse.ok) {
        const error = await deleteResponse.text()
        const sanitizedError = sanitizeErrorMessage(error)
        throw new Error(`Failed to delete document chunks: ${sanitizedError}`)
      }
      
      // Wait for Qdrant to process the deletion and stabilize
      // This prevents EPIPE/connection issues when immediately inserting after deletion
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second wait
      
      // Verify Qdrant is responsive before returning
      let isResponsive = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const testResponse = await fetch(`${this.qdrantUrl}/collections/${collectionName}`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          })
          if (testResponse.ok) {
            isResponsive = true
            break
          }
        } catch (error) {
          console.log(`❌ Qdrant responsiveness check ${attempt}/3 failed`)
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }
      
      if (!isResponsive) {
        console.warn('⚠️ Qdrant may not be fully responsive after deletion - proceeding anyway')
      }
      
    } catch (error) {
      console.error('Error deleting document chunks:', error)
      throw error
    }
  }

  async getCollectionInfo(agentId: string): Promise<{ 
    exists: boolean; 
    pointsCount?: number; 
    vectorsCount?: number 
  }> {
    try {
      const collectionName = `agent_${agentId}`
      const response = await fetch(`${this.qdrantUrl}/collections/${collectionName}`)
      
      if (response.status === 404) {
        return { exists: false }
      }
      
      if (!response.ok) {
        throw new Error('Failed to get collection info')
      }
      
      const info = await response.json()
      return {
        exists: true,
        pointsCount: info.result.points_count,
        vectorsCount: info.result.vectors_count
      }
    } catch (error) {
      console.error('Error getting collection info:', error)
      return { exists: false }
    }
  }

  async getDocumentRAGStatus(agentId: string, documentId: string): Promise<{
    inRAG: boolean;
    chunksCount: number;
  }> {
    try {
      const collectionName = `agent_${agentId}`
      
      // Check if collection exists first
      const collectionInfo = await this.getCollectionInfo(agentId)
      if (!collectionInfo.exists) {
        return { inRAG: false, chunksCount: 0 }
      }
      
      // Search for chunks with this documentId
      const searchResponse = await fetch(`${this.qdrantUrl}/collections/${collectionName}/points/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [
              { key: 'agentId', match: { value: agentId } },
              { key: 'documentId', match: { value: documentId } }
            ]
          },
          limit: 1000, // Sufficient to count chunks for a single document
          with_payload: false // We only need the count
        })
      })
      
      if (!searchResponse.ok) {
        console.error('Failed to check document RAG status')
        return { inRAG: false, chunksCount: 0 }
      }
      
      const searchResults = await searchResponse.json()
      const chunksCount = searchResults.result?.points?.length || 0
      
      return {
        inRAG: chunksCount > 0,
        chunksCount
      }
    } catch (error) {
      console.error('Error checking document RAG status:', error)
      return { inRAG: false, chunksCount: 0 }
    }
  }

  async healthCheck(): Promise<{ 
    qdrantConnected: boolean; 
    embeddingModelLoaded: boolean;
    error?: string 
  }> {
    try {
      // Check Qdrant connection - use root endpoint instead of /health
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      const qdrantResponse = await fetch(`${this.qdrantUrl}/`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      const qdrantConnected = qdrantResponse.ok
      
      // Check embedding model and try to initialize if not loaded
      let embeddingModelLoaded = !!this.embeddingModel
      
      if (!embeddingModelLoaded) {
        try {
          console.log('Embedding model not loaded, attempting initialization...')
          await this.initializeEmbeddingModel()
          embeddingModelLoaded = !!this.embeddingModel
        } catch (modelError) {
          console.error('Failed to initialize embedding model during health check:', modelError)
          return {
            qdrantConnected,
            embeddingModelLoaded: false,
            error: `Embedding model initialization failed: ${modelError instanceof Error ? modelError.message : 'Unknown error'}`
          }
        }
      }
      
      return {
        qdrantConnected,
        embeddingModelLoaded
      }
    } catch (error) {
      return {
        qdrantConnected: false,
        embeddingModelLoaded: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Singleton instance
export const ragService = new RAGService() 