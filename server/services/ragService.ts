import { pipeline } from '@xenova/transformers'
import type { Pipeline } from '@xenova/transformers'
import crypto from 'crypto'

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
      console.log('Loading multilingual embedding model...')
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
          throw new Error(`Failed to create Qdrant collection: ${error}`)
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
    const chunks: string[] = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    let currentChunk = ''
    let currentLength = 0
    
    for (const sentence of sentences) {
      const sentenceLength = sentence.trim().length
      
      if (currentLength + sentenceLength > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        
        // Add overlap by keeping last few words
        const words = currentChunk.split(' ')
        const overlapWords = words.slice(-Math.floor(overlap / 10))
        currentChunk = overlapWords.join(' ') + ' ' + sentence.trim()
        currentLength = currentChunk.length
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence.trim()
        currentLength += sentenceLength
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks.filter(chunk => chunk.length > 20) // Filter very short chunks
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

  async processDocument(agentId: string, documentId: string, content: string, metadata: {
    type: 'file' | 'url' | 'website'
    title: string
    source?: string
  }): Promise<{ chunksCreated: number; collectionName: string }> {
    try {
      console.log(`Processing document ${documentId} for agent ${agentId}`)
      
      await this.ensureCollectionExists(agentId)
      
      // Clean and chunk the content
      const cleanContent = content.replace(/\s+/g, ' ').trim()
      const chunks = this.chunkText(cleanContent)
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
            documentTitle: metadata.title,
            chunkIndex: i,
            language,
            source: metadata.source,
            originalId: `${documentId}_chunk_${i}`
          }
        }
        
        points.push(point)
      }
      
      // Batch insert to Qdrant
      const collectionName = `agent_${agentId}`
      
      // Add timeout for Qdrant connection
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const insertResponse = await fetch(`${this.qdrantUrl}/collections/${collectionName}/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: points
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!insertResponse.ok) {
        const error = await insertResponse.text()
        throw new Error(`Failed to insert points to Qdrant: ${error}`)
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
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query)
      
      // Build filter conditions
      const filterConditions: any[] = [
        { key: 'agentId', match: { value: agentId } }
      ]
      
      if (filters?.documentType) {
        filterConditions.push({ key: 'documentType', match: { value: filters.documentType } })
      }
      
      if (filters?.language) {
        filterConditions.push({ key: 'language', match: { value: filters.language } })
      }
      
      // Search in Qdrant
      const searchResponse = await fetch(`${this.qdrantUrl}/collections/${collectionName}/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector: queryEmbedding,
          limit,
          with_payload: true,
          filter: filterConditions.length > 0 ? { must: filterConditions } : undefined
        })
      })
      
      if (!searchResponse.ok) {
        const error = await searchResponse.text()
        throw new Error(`Qdrant search failed: ${error}`)
      }
      
      const searchResults = await searchResponse.json()
      
      // Transform results
      const results: SearchResult[] = searchResults.result.map((hit: any) => ({
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
      }))
      
      console.log(`Found ${results.length} relevant chunks for query: "${query.substring(0, 50)}..."`)
      
      return results
    } catch (error) {
      console.error('Error searching relevant chunks:', error)
      return []
    }
  }

  async deleteDocumentChunks(agentId: string, documentId: string): Promise<void> {
    try {
      const collectionName = `agent_${agentId}`
      
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
        throw new Error(`Failed to delete document chunks: ${error}`)
      }
      
      console.log(`✅ Deleted all chunks for document ${documentId}`)
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
      
      // Check embedding model
      if (!this.embeddingModel) {
        await this.initializeEmbeddingModel()
      }
      const embeddingModelLoaded = !!this.embeddingModel
      
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