# Qdrant RAG System Setup Guide

## 🚀 Overview

Your Agent AI Server now includes a **Retrieval-Augmented Generation (RAG)** system powered by **Qdrant** vector database and multilingual embeddings. This enables agents to intelligently search through large context documents and provide more relevant, accurate responses.

## 🏗️ Architecture

```
User Message → RAG Search → Relevant Chunks → AI Response
     ↓              ↓              ↓             ↓
Chatwoot → Vector Embedding → Qdrant DB → Prediction Guard
```

## 📋 Features

- **🌍 Multilingual Support**: Handles 100+ languages automatically
- **🔍 Smart Chunking**: Intelligently splits documents with overlap
- **⚡ Fast Search**: Vector similarity search in milliseconds  
- **🎯 Relevance Scoring**: Returns most relevant content first
- **🔄 Auto-Processing**: Documents automatically processed on upload
- **💾 Persistent Storage**: Qdrant data survives restarts

## 🛠️ Setup Instructions

### 1. Install Dependencies

The required packages have been added to `package.json`:

```bash
npm install
```

### 2. Start Qdrant Database

Using Docker Compose (recommended):

```bash
# Start Qdrant service
docker-compose up -d qdrant

# Verify Qdrant is running
curl http://localhost:6333/health
```

### 3. Environment Configuration

Add to your `.env` file:

```env
# Qdrant Vector Database Configuration
QDRANT_URL=http://localhost:6333
```

### 4. Start Your Server

```bash
npm run dev
```

## 🔧 How It Works

### Document Processing Pipeline

1. **Upload/Add Document** → Agent context documents
2. **Auto-Processing** → Document split into chunks (500 chars with 50 char overlap)
3. **Embedding Generation** → Each chunk converted to 384-dimension vector
4. **Storage** → Vectors stored in Qdrant with metadata
5. **Ready for Search** → Agent can now use RAG for responses

### Response Generation Pipeline

1. **User Message** → Webhook from Chatwoot
2. **Query Embedding** → Convert message to vector
3. **Similarity Search** → Find top 5 relevant chunks in Qdrant
4. **Context Assembly** → Build prompt with relevant chunks
5. **AI Generation** → Prediction Guard generates response
6. **Response Delivery** → Send back to Chatwoot

## 📊 Multilingual Support

### Supported Languages

The system automatically detects and handles:

- **Romance Languages**: French, Spanish, Portuguese, Italian
- **Germanic Languages**: German, English
- **Slavic Languages**: Russian
- **Asian Languages**: Chinese, Japanese, Korean
- **Arabic Languages**: Arabic and variants
- **Greek**: Modern Greek
- **Fallback**: English for undetected languages

### Language Detection

Documents are automatically analyzed for language patterns:

```javascript
// Example language detection
const language = detectLanguage("Bonjour, comment allez-vous?")
// Returns: "romance"
```

## 🎛️ Configuration Options

### Document Chunking

```javascript
const chunkingOptions = {
  chunkSize: 500,     // Characters per chunk
  overlap: 50,        // Character overlap between chunks
  minChunkSize: 20    // Minimum chunk size to keep
}
```

### Search Parameters

```javascript
const searchOptions = {
  limit: 5,           // Max chunks to retrieve
  scoreThreshold: 0.1 // Minimum similarity score
}
```

### Qdrant Collection Settings

```javascript
const collectionConfig = {
  vectorSize: 384,           // all-MiniLM-L12-v2 embedding size
  distance: 'Cosine',        // Similarity metric
  segmentNumber: 2,          // Performance optimization
  replicationFactor: 1       // Single instance setup
}
```

## 🔍 Testing the System

### 1. Check RAG Health

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/rag/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "qdrant": { "connected": true },
    "embeddings": { "modelLoaded": true },
    "timestamp": "2024-12-XX..."
  }
}
```

### 2. Upload Test Documents

1. Login to dashboard
2. Create/edit an agent
3. Upload PDF, DOC, or text files
4. Watch console logs for RAG processing

### 3. Test Agent Responses

1. Send webhook with question related to uploaded content
2. Check logs for "Using RAG" messages
3. Verify response uses relevant document context

## 📈 Performance Monitoring

### Key Metrics to Watch

```bash
# Qdrant status
curl http://localhost:6333/collections

# Collection info for specific agent
curl http://localhost:6333/collections/agent_AGENT_ID

# Memory usage
docker stats qdrant
```

### Expected Performance

- **Document Processing**: 1-5 seconds per 1000 words
- **Search Queries**: < 100ms for typical collections
- **Memory Usage**: ~500MB-2GB depending on document volume
- **Disk Usage**: ~1.5x raw document size (with vectors)

## 🔧 Troubleshooting

### Common Issues

#### 1. "Qdrant not connected"
```bash
# Check if Qdrant is running
docker ps | grep qdrant
docker-compose logs qdrant

# Restart if needed
docker-compose restart qdrant
```

#### 2. "Embedding model failed to load"
```bash
# Check available disk space (models ~100MB)
df -h

# Check console logs
npm run dev
# Look for "Loading multilingual embedding model..."
```

#### 3. "No relevant chunks found"
```bash
# Verify documents were processed
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:3000/api/rag/health

# Check collection exists
curl http://localhost:6333/collections/agent_YOUR_AGENT_ID
```

#### 4. "Search taking too long"
```bash
# Check collection size
curl http://localhost:6333/collections/agent_YOUR_AGENT_ID

# Consider reducing max chunks per search if > 10k documents
```

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
```

Look for these log messages:
- ✅ "Loading multilingual embedding model..."
- ✅ "Created X chunks from document"  
- ✅ "Using RAG: Found X context chunks"
- ✅ "RAG retrieved X relevant chunks"

## 🚀 Performance Optimization

### For Large Document Collections (10k+ docs)

1. **Increase Qdrant resources**:
```yaml
# docker-compose.yml
qdrant:
  deploy:
    resources:
      limits:
        memory: 4G
      reservations:
        memory: 2G
```

2. **Optimize search parameters**:
```javascript
// Reduce search results for faster responses
const relevantChunks = await ragService.searchRelevantChunks(
  agentId,
  userMessage,
  3  // Reduced from 5
)
```

3. **Use filtering**:
```javascript
// Search only specific document types
const results = await ragService.searchRelevantChunks(
  agentId,
  query,
  5,
  { documentType: 'website', language: 'english' }
)
```

## 📚 Next Steps

### Immediate Benefits

- **Faster responses**: Only relevant context sent to AI
- **Better accuracy**: Context-aware answers  
- **Multilingual support**: Works with any language
- **Scalable**: Handles large document sets

### Future Enhancements

- **Hybrid search**: Combine keyword + vector search
- **Advanced chunking**: Document-aware splitting
- **Query expansion**: Automatic query enhancement  
- **Analytics**: Search performance metrics

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review console logs for error messages
3. Verify Qdrant connectivity: `curl http://localhost:6333/health`
4. Test with simple documents first
5. Enable debug logging for detailed information

---

**Your RAG system is now ready! Upload documents and start getting smarter AI responses.** 🎉 