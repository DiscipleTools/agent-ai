# Prediction Guard AI Setup Guide

## Overview

This guide explains how to set up and configure Prediction Guard AI integration for the Agent AI Server. Prediction Guard provides secure, private AI inference with built-in safety features.

The system supports two configuration methods:
1. **Database Settings** (Recommended): Configure through the admin settings interface
2. **Environment Variables**: Configure through `.env` file (fallback)

## Prerequisites

1. **Prediction Guard Account**: Sign up at [predictionguard.com](https://predictionguard.com)
2. **API Key**: Obtain your API key from the Prediction Guard dashboard
3. **Agent AI Server**: Ensure your server is properly set up

## Configuration Methods

### Method 1: Database Settings (Recommended)

1. **Log in as Admin**: Access the dashboard with admin credentials
2. **Navigate to Settings**: Go to the Settings section
3. **Configure Prediction Guard**:
   - **API Key**: Enter your Prediction Guard API key
   - **Endpoint**: Use default `https://api.predictionguard.com` or custom endpoint
   - **Model**: Select your preferred default model
4. **Save Settings**: Click "Save" to store configuration in database
5. **Test Connection**: Use "Test AI Connection" to verify setup

**Advantages of Database Settings:**
- No server restart required when changing configuration
- Settings are shared across all server instances
- Easy to update through the web interface
- Automatic cache invalidation when settings change

### Method 2: Environment Variables (Fallback)

Add the following environment variables to your `.env` file:

```env
# Prediction Guard AI Configuration
PREDICTION_GUARD_API_KEY=your-prediction-guard-api-key
PREDICTION_GUARD_ENDPOINT=https://api.predictionguard.com
PREDICTION_GUARD_DEFAULT_MODEL=Hermes-3-Llama-3.1-8B
```

**Note**: Database settings take priority over environment variables. Environment variables are used as fallback when database settings are not configured.

### Configuration Priority

The system uses the following priority order:
1. **Database Settings** (highest priority)
2. **Environment Variables** (fallback)
3. **Default Values** (if nothing else is configured)

### Environment Variables Explained

- **PREDICTION_GUARD_API_KEY**: Your API key from Prediction Guard dashboard (required)
- **PREDICTION_GUARD_ENDPOINT**: API endpoint URL (default: https://api.predictionguard.com)
- **PREDICTION_GUARD_DEFAULT_MODEL**: Default model to use for AI responses

## Available Models

The following models are available through Prediction Guard:

| Model Name | Type | Use Case | Context Length |
|------------|------|----------|----------------|
| Hermes-3-Llama-3.1-70B | Chat | General instruction following, reasoning | 20,480 |
| Hermes-3-Llama-3.1-8B | Chat | General instruction following | 20,480 |
| DeepSeek-R1-Distill-Qwen-32B | Chat/Reasoning | Advanced reasoning tasks | 20,480 |
| Qwen2.5-Coder-14B-Instruct | Code | Code generation and tech questions | 8,192 |
| neural-chat-7b-v3-3 | Chat | Basic conversation | 8,192 |

## API Features

### Chat Completions

The integration uses Prediction Guard's chat completions endpoint with the following features:

- **Secure Processing**: No data logging or caching
- **Built-in Safety**: Automatic content filtering
- **Multiple Models**: Support for various specialized models
- **Context Management**: Proper handling of conversation context

### Request Parameters

- **model**: AI model to use for generation
- **messages**: Array of conversation messages
- **temperature**: Controls randomness (0.0 to 1.0)
- **max_tokens**: Maximum response length (1 to 2000)

## Agent Configuration

### Basic Agent Setup

When creating an agent, you can configure:

```javascript
{
  name: "Customer Support Agent",
  description: "Handles customer inquiries",
  prompt: "You are a helpful customer support agent...",
  settings: {
    temperature: 0.7,        // Response creativity (0.0-1.0)
    maxTokens: 500,          // Maximum response length
    responseDelay: 0         // Delay before responding (seconds)
  }
}
```

### Context Documents

Agents can use additional context from:

- **File uploads**: PDF, TXT, DOC, DOCX files
- **URL content**: Web pages and documentation
- **Custom text**: Manual context addition

## Testing the Integration

### 1. Test API Connection

Use the built-in test endpoint:

```bash
POST /api/settings/test-ai
Authorization: Bearer <your-jwt-token>
```

Response:
```json
{
  "success": true,
  "message": "Connection successful",
  "data": {
    "model": "Hermes-3-Llama-3.1-8B",
    "endpoint": "https://api.predictionguard.com",
    "hasApiKey": true
  }
}
```

### 2. Get Available Models

Fetch available models:

```bash
GET /api/settings/ai-models
Authorization: Bearer <your-jwt-token>
```

### 3. Test Agent Response

Create a test agent and send a webhook to verify AI responses.

## Webhook Integration

### Chatwoot Webhook Flow

1. **Incoming Message**: Chatwoot sends webhook to agent endpoint
2. **AI Processing**: Agent uses Prediction Guard to generate response
3. **Context Enhancement**: Includes agent prompt and context documents
4. **Response Delivery**: Sends AI response back to Chatwoot

### Webhook Endpoint

```
POST /api/webhook/agent/{webhook-id}
```

### Example Webhook Payload

```json
{
  "conversation": {
    "id": 123,
    "account_id": 1
  },
  "message": {
    "content": "Hello, I need help with my order",
    "message_type": "incoming"
  }
}
```

## Error Handling

### Common Errors

1. **Invalid API Key (401)**
   - Check your `PREDICTION_GUARD_API_KEY`
   - Verify key is active in dashboard

2. **Rate Limit Exceeded (429)**
   - Reduce request frequency
   - Consider upgrading plan

3. **Model Not Found (404)**
   - Check model name spelling
   - Verify model availability

4. **Server Error (500)**
   - Temporary Prediction Guard issue
   - Retry after delay

### Fallback Responses

When AI generation fails, agents automatically respond with:
> "I apologize, but I'm experiencing technical difficulties right now. Please try again later or contact support if the issue persists."

## Security Features

### Data Privacy

- **No Data Storage**: Prediction Guard doesn't store your data
- **No Training**: Your data isn't used for model training
- **Secure Transit**: All requests use HTTPS encryption

### Content Safety

- **Toxicity Detection**: Automatic filtering of harmful content
- **PII Protection**: Personal information detection and handling
- **Injection Prevention**: Protection against prompt injection attacks

## Performance Optimization

### Response Times

- **Target**: < 2 seconds for webhook processing
- **AI Generation**: < 10 seconds typical
- **Optimization**: Use appropriate max_tokens settings

### Rate Limits

- **Default**: Varies by plan
- **Monitoring**: Check response headers for limits
- **Scaling**: Contact Prediction Guard for higher limits

## Troubleshooting

### Debug Mode

Enable detailed logging by setting:
```env
LOG_LEVEL=debug
```

### Common Issues

1. **Empty Responses**
   - Check prompt length and clarity
   - Verify model supports your use case

2. **Slow Responses**
   - Reduce max_tokens if possible
   - Check network connectivity

3. **Context Issues**
   - Verify context documents are properly formatted
   - Check total context length limits

## Support

- **Prediction Guard Docs**: [docs.predictionguard.com](https://docs.predictionguard.com)
- **API Reference**: [API Documentation](https://docs.predictionguard.com/api-reference)
- **Discord Community**: Join Prediction Guard Discord
- **Email Support**: Contact Prediction Guard support

## Example Implementation

### Complete Agent Setup

```javascript
// Create agent with Prediction Guard integration
const agent = {
  name: "Technical Support Bot",
  description: "Provides technical assistance",
  prompt: `You are a knowledgeable technical support agent. 
           Help users with their technical questions clearly and concisely.
           Always be helpful and professional.`,
  settings: {
    temperature: 0.3,    // Lower for more consistent responses
    maxTokens: 300,      // Concise responses
    responseDelay: 1     // Brief pause before responding
  },
  contextDocuments: [
    {
      type: "file",
      content: "Technical documentation content...",
      filename: "tech-docs.pdf"
    }
  ]
}
```

This setup provides a robust, secure AI agent powered by Prediction Guard's advanced language models. 