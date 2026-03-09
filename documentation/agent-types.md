# Agents

Agents are unified workflow automation units that can perform various actions based on triggers and conditions.

## Single Agent Type
All agents now use the same unified type with configurable workflows instead of separate agent types.

## Action Types
Agents can perform different actions through their workflow configuration:

### AI-Powered Actions
- **ai_response**: Generate automated responses to messages
- **ai_summarize**: Create intelligent summaries of conversations
- **ai_categorize**: Automatically categorize conversations
- **ai_sentiment_analysis**: Analyze sentiment of messages

### Conversation Management Actions
- **change_status**: Change conversation status
- **assign_agent**: Assign conversations to specific agents
- **add_private_note**: Add internal notes
- **add_public_note**: Add customer-visible notes
- **set_priority**: Set conversation priority
- **set_custom_attribute**: Set custom attributes
- **update_contact_attribute**: Update contact information

### Flow Control Actions
- **wait**: Add delays in workflow execution
- **stop_workflow**: Halt workflow execution

## Inbox Assignment Rules
- Agents can be assigned to inboxes as either response agents or processing pipeline agents
- Only one response agent per inbox is allowed
- Multiple processing agents can be assigned with different priorities
- Processing pipeline executes in order: pre-process → response → main-process → post-process 
