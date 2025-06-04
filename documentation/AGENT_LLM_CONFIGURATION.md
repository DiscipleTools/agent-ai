# Agent LLM Model Configuration

## Overview

Agents now support configuring which LLM model they use for generating responses. By default, agents use the system's default AI connection and model, but they can be configured to use a specific AI connection and model if available.

The interface uses a single dropdown that combines connection and model selection for simplicity, displaying options in the format "Connection Name - Model Name".

## Features

### Default Behavior
- **Default Connection**: Agents use the system's default AI connection configured in Settings
- **Default Model**: Within the chosen connection, agents use the default model
- **Fallback**: If no specific configuration is set, agents automatically use the best available option

### Custom Configuration
- **Custom Connection**: Choose a specific AI connection for the agent
- **Custom Model**: Select a specific model from the available models in the chosen connection
- **Per-Agent Settings**: Each agent can have its own LLM configuration independent of others

## Configuration Options

### Agent Settings
Each agent now has two additional settings in the `settings` object:

```javascript
{
  settings: {
    temperature: 0.3,
    maxTokens: 500,
    responseDelay: 0,
    connectionId: "optional-connection-id",  // NEW
    modelId: "optional-model-id"             // NEW
  }
}
```

### Connection Selection
- **Empty/Null**: Use system default connection
- **Valid Connection ID**: Use the specified AI connection

### Model Selection
- **Empty/Null**: Use default model for the connection
- **Valid Model ID**: Use the specified model (must be available and enabled in the connection)

## User Interface

### Agent Form
The agent creation/editing form now includes:

1. **AI Model Dropdown**
   - "Use Default Model" option
   - List of all available models in the format "Connection Name - Model Name"
   - Shows provider information and model names clearly
   - Automatically handles both connection and model selection

2. **Help Text**
   - Shows current default connection and model
   - Indicates when custom model is selected
   - Provides loading status when fetching available models

### Visual Indicators
- **Default Labels**: Clear indication when using system defaults
- **Custom Labels**: Shows when agent has custom model configuration
- **Connection Info**: Model options show both connection name and model name
- **Loading State**: Shows "Loading available models..." while fetching options

## API Changes

### New Endpoint
```http
GET /api/agents/ai-connections
Authorization: Bearer <token>
```

Returns available AI connections for agent configuration:
```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "_id": "connection-id",
        "name": "My OpenAI Connection",
        "provider": "openai",
        "endpoint": "https://api.openai.com/v1",
        "availableModels": [
          {
            "id": "gpt-4",
            "name": "GPT-4",
            "enabled": true
          }
        ]
      }
    ],
    "defaultConnection": {
      "connectionId": "default-connection-id",
      "modelId": "default-model-id",
      "connectionName": "Default Connection",
      "modelName": "Default Model"
    }
  }
}
```

### Updated Agent Endpoints
Both agent creation (`POST /api/agents`) and update (`PUT /api/agents/:id`) now accept:

```json
{
  "settings": {
    "connectionId": "optional-connection-id",
    "modelId": "optional-model-id"
  }
}
```

### Webhook Processing
The webhook handler now passes the agent's connection and model settings to the AI service:

```javascript
await aiService.generateResponse(
  agentId,
  prompt,
  contextDocuments,
  userMessage,
  {
    connectionId: agent.settings?.connectionId,
    modelId: agent.settings?.modelId,
    // ... other settings
  }
)
```

## Implementation Details

### Database Schema
The Agent model now includes in the `settings` subdocument:

```javascript
settings: {
  // ... existing fields
  connectionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  modelId: {
    type: String,
    required: false
  }
}
```

### AI Service Logic
The AI service uses the following priority for selecting connection and model:

1. **Agent-specific**: Use agent's connectionId/modelId if provided
2. **System default**: Use system's default connection/model
3. **Fallback**: Use first available active connection and enabled model

### Error Handling
- **Invalid Connection ID**: Returns validation error during agent creation/update
- **Unavailable Model**: AI service falls back to connection's default model
- **No Connections**: AI service returns meaningful error message

## Usage Examples

### UI Model Selection
The dropdown will show options like:
- "Use Default Model"
- "OpenAI Connection - GPT-4"
- "OpenAI Connection - GPT-3.5 Turbo"
- "Prediction Guard - Hermes-3-Llama-3.1-70B"
- "Custom AI - Claude-3"

When a user selects "OpenAI Connection - GPT-4", the system automatically sets:
- `connectionId`: The ObjectId of the OpenAI connection
- `modelId`: "gpt-4"

### Creating an Agent with Custom LLM
```javascript
const agentData = {
  name: "Customer Support Bot",
  prompt: "You are a helpful customer support agent...",
  settings: {
    temperature: 0.2,
    maxTokens: 300,
    connectionId: "64f7b1a2c3d4e5f6a7b8c9d0", // Set automatically by UI
    modelId: "gpt-4-turbo"                      // Set automatically by UI
  }
}
```

### Using Default Configuration
```javascript
const agentData = {
  name: "General Assistant",
  prompt: "You are a helpful assistant...",
  settings: {
    temperature: 0.5,
    maxTokens: 500
    // connectionId and modelId omitted = use defaults
  }
}
```

## Benefits

### Flexibility
- **Model Specialization**: Use different models for different agent types
- **Cost Optimization**: Use smaller/cheaper models for simple agents
- **Performance Tuning**: Use faster models for real-time applications

### Scalability
- **Load Distribution**: Spread load across multiple AI providers
- **Provider Redundancy**: Configure backup connections for reliability
- **Model Testing**: A/B test different models with different agents

### Control
- **Per-Agent Configuration**: Fine-tune each agent's AI capabilities
- **Easy Management**: Change agent models without code changes
- **Centralized Settings**: Manage all AI connections from one place

## Migration

### Existing Agents
- **Automatic**: Existing agents continue to work with system defaults
- **No Breaking Changes**: No migration required
- **Gradual Adoption**: Configure models per agent as needed

### Settings Migration
- **Backward Compatible**: Old settings format still supported
- **Enhanced UI**: New interface for easier configuration
- **Progressive Enhancement**: New features without disrupting existing functionality

## Troubleshooting

### Common Issues

1. **Model Not Available**
   - Ensure model is enabled in the AI connection
   - Check if connection is active
   - Verify model ID spelling

2. **Connection Not Found**
   - Ensure connection exists and is active
   - Check connection ID validity
   - Verify user has access to connection

3. **Fallback Behavior**
   - Agent falls back to default connection if custom one fails
   - Error logs provide details about fallback reasons
   - Monitor logs for configuration issues

### Debugging
- **AI Service Logs**: Check which connection/model is actually used
- **Agent Settings**: Verify settings are saved correctly
- **Connection Status**: Ensure all AI connections are active and configured

This feature provides comprehensive control over which LLM models agents use while maintaining simplicity for basic use cases. 