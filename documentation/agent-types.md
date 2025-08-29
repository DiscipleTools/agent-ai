# Agent Types

## Response Agents
- **Purpose**: Handle customer conversations and provide responses
- **Limitation**: Each Chatwoot inbox can only be associated with one response agent
- **Default**: All new agents are created as response agents

## Future Agent Types
The following agent types are planned for future releases:
- **Analytics**: Analyze conversation data and provide insights
- **Moderation**: Monitor conversations for policy violations
- **Routing**: Route conversations to appropriate agents or departments

## Inbox Assignment Rules
- Only one response agent per inbox is allowed
- When creating/updating a response agent, the system validates that no other response agent is already assigned to the same inbox
- If an inbox already has a response agent, you must remove it before assigning a new one 
