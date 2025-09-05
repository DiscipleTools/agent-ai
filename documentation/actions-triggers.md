# Workflow Triggers and Actions Documentation

This document provides comprehensive documentation for all triggers and actions in the Agent AI workflow system, based on actual code implementation. Each item indicates whether it's fully implemented, partially implemented, or not implemented.

## Triggers

Triggers define when a workflow agent should activate. All triggers are currently **only processed for `message_created` events** via the webhook endpoint at `/api/webhook/inbox/[id]`.

### Conversation Events

#### `conversation_created`
- **Status**: L **Not Processed**
- **Description**: Should trigger when a new conversation is created
- **Implementation**: Defined in schema but webhook only processes `message_created` events


#### `conversation_status_changed`
- **Status**: L **Not Processed**
- **Description**: Should trigger when conversation status changes (open, resolved, pending, snoozed)
- **Implementation**: Defined in schema but webhook only processes `message_created` events

#### `conversation_assigned`
- **Status**: L **Not Processed**
- **Description**: Should trigger when conversation is assigned to an agent
- **Implementation**: Defined in schema but webhook only processes `message_created` events



### Message Events

#### `message_created`
- **Status**:  **Fully Implemented**
- **Description**: Triggers when a new message is received
- **Implementation**: 
  - Webhook endpoint `/api/webhook/inbox/[id]` processes this event
  - Skips outgoing/template messages automatically
  - Skips empty messages
  - Calls workflow engine to process matching agents
  - Supported via Chatwoot webhooks




## Conditions

Conditions filter when triggers should actually execute. Most conditions are **not implemented** in the evaluation logic.

### Message Content Conditions

#### `message_contains`
- **Status**:  **Fully Implemented**
- **Description**: Check if message contains specific text
- **Operators**: `contains`, `not_contains`, `equals`, `not_equals`
- **Implementation**: Uses case-insensitive string comparison

#### `message_length`
- **Status**: � **Partially Implemented**
- **Description**: Check message character length
- **Implementation**: Only `message_length_greater` and `message_length_less` are implemented as hardcoded condition types

#### `message_language`
- **Status**: L **Not Implemented**
- **Description**: Should detect message language
- **Implementation**: Defined in schema but no evaluation logic exists

### Contact Conditions

#### `contact_attribute`
- **Status**: L **Not Implemented**
- **Description**: Should check contact custom attributes
- **Implementation**: Defined in schema but no evaluation logic exists

#### `contact_email`
- **Status**: L **Not Implemented**
- **Description**: Should check contact email address
- **Implementation**: Defined in schema but no evaluation logic exists

### Conversation Conditions

#### `conversation_status`
- **Status**: � **Partially Implemented**
- **Description**: Check current conversation status
- **Implementation**: Only `conversation_status_equals` is implemented as hardcoded condition type

#### `conversation_message_count`
- **Status**: L **Not Implemented**
- **Description**: Should check number of messages in conversation
- **Implementation**: Defined in schema but no evaluation logic exists

### AI-Evaluated Conditions

#### `ai_evaluation`
- **Status**: L **Not Implemented**
- **Description**: Should use AI to evaluate custom conditions
- **Implementation**: Defined in schema but no evaluation logic exists

### Hardcoded Conditions (Not in UI Schema)

These conditions exist in the workflow engine but are not exposed in the UI:

#### `message_not_contains`
- **Status**:  **Implemented**
- **Description**: Check if message does NOT contain specific text

#### `conversation_unassigned`
- **Status**:  **Implemented**  
- **Description**: Check if conversation has no assigned agent

#### `conversation_assignee_equals`
- **Status**:  **Implemented**
- **Description**: Check if conversation is assigned to specific agent ID

#### `contact_is_new`
- **Status**:  **Implemented**
- **Description**: Check if this is contact's first conversation (message_count === 1)

#### `channel_type_equals`
- **Status**:  **Implemented**
- **Description**: Check the inbox channel type

#### `inbox_equals`
- **Status**:  **Implemented**
- **Description**: Check if event is from specific inbox ID

## Actions

Actions define what happens when a workflow is triggered and conditions are met.

### AI-Powered Actions

#### `ai_response`
- **Status**:  **Fully Implemented**
- **Description**: Generate and send AI response based on conversation context
- **Implementation**: 
  - Gets conversation history (last 10 messages)
  - Uses aiService to generate response with action's prompt and context documents
  - Sends response via chatwootService.sendMessage()
  - Supports custom prompts, temperature, max tokens, and model settings
  - **This action works end-to-end**

#### `ai_summarize`
- **Status**: L **Not Implemented**
- **Description**: Should create a summary of the conversation
- **Implementation**: Defined in schema but no execution logic exists

#### `ai_categorize`
- **Status**: L **Not Implemented**
- **Description**: Should auto-categorize the conversation based on content
- **Implementation**: Defined in schema but no execution logic exists

#### `ai_sentiment_analysis`
- **Status**: L **Not Implemented**
- **Description**: Should analyze the sentiment of messages
- **Implementation**: Defined in schema but no execution logic exists

### Conversation Management Actions

#### `change_status`
- **Status**:  **Fully Implemented**
- **Description**: Update conversation status
- **Implementation**:
  - Changes conversation status to: open, resolved, pending, or snoozed
  - Uses chatwootService.updateConversationStatus()
  - **This action works end-to-end**

#### `assign_agent`
- **Status**: L **Placeholder Only**
- **Description**: Should assign conversation to specific agent or team
- **Implementation**: Returns placeholder object `{ assigned: true, agentId: ... }` - does not actually assign

#### `add_private_note`
- **Status**: � **Partially Implemented**
- **Description**: Add internal note to conversation
- **Implementation**: 
  - Uses chatwootService.sendMessage() to send note content
  - **Note**: Actually sends as regular message, not as private internal note

#### `add_public_note`
- **Status**: � **Partially Implemented**
- **Description**: Add customer-visible note
- **Implementation**: 
  - Uses chatwootService.sendMessage() to send note content
  - Same implementation as private note - no distinction

#### `set_priority`
- **Status**: L **Placeholder Only**
- **Description**: Should set conversation priority level
- **Implementation**: Returns placeholder object `{ priority: ... }` - does not actually set priority

#### `set_custom_attribute`
- **Status**: L **Placeholder Only**
- **Description**: Should set conversation custom attributes
- **Implementation**: Returns placeholder object with attribute name/value - does not actually set

#### `update_contact_attribute`
- **Status**: L **Not Implemented**
- **Description**: Should modify contact custom attributes
- **Implementation**: Defined in schema but no execution logic exists

### Flow Control Actions

#### `wait`
- **Status**:  **Fully Implemented**
- **Description**: Pause workflow execution for specified duration
- **Implementation**: 
  - Uses setTimeout() to wait specified milliseconds (default 1000ms)
  - **This action works as intended**

#### `stop_workflow`
- **Status**: L **Not Implemented**
- **Description**: Should stop workflow execution
- **Implementation**: Defined in schema but no execution logic exists

## API Endpoints

### Webhook Processing
- **Endpoint**: `POST /api/webhook/inbox/[id]`
- **Status**:  **Fully Implemented**
- **Description**: Receives Chatwoot webhook events and processes them
- **Features**:
  - Webhook signature validation (optional)
  - Only processes `message_created` events
  - Skips outgoing/template/empty messages
  - Automatically opens conversations if needed
  - Processes both legacy agents and new workflow agents
  - Returns detailed execution results

### Agent Management
- **Create/Update Agents**: `POST/PUT /api/agents`
- **Status**:  **Implemented with validation**
- **Description**: Validates trigger and action types against allowed enums

## Summary

### What Actually Works End-to-End:
1. **`message_created` trigger** - Only via webhook for incoming messages
2. **`ai_response` action** - Fully functional AI responses
3. **`change_status` action** - Can change conversation status
4. **`wait` action** - Can pause execution
5. **Message content conditions** - Basic text matching works
6. **Several hardcoded conditions** - For conversation/inbox/contact checks

### What's Partially Working:
1. **Note actions** - Send messages instead of actual notes
2. **Message length conditions** - Only hardcoded variants exist

### What Doesn't Work:
1. **Most triggers** - Only `message_created` is processed
2. **Most AI actions** - Only basic response works
3. **Most conversation actions** - Return placeholders only
4. **Most conditions** - Not implemented in evaluation logic
5. **Time-based triggers** - No scheduling system exists
6. **Contact/widget events** - Not processed by webhook

The system is primarily functional for basic AI response workflows triggered by incoming messages with simple text-based conditions.