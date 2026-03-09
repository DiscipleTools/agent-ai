# Agent Workflow Redesign

## Current State

The current agent system is limited to **Response Agents** that:
- Monitor incoming messages
- Call AI services to generate responses
- Send responses back to Chatwoot conversations

This approach is restrictive and doesn't leverage the full potential of workflow automation.

## Proposed New Architecture

### Overview

Transform the agent system into a comprehensive **workflow engine** where agents are defined by:
- **Triggers**: Events that start the workflow
- **Actions**: What happens when triggered
- **Conditions**: Optional logic to determine if actions should execute

### Core Components

#### 1. Triggers

**Conversation Events:**
- `conversation_created` - New conversation started
- `conversation_status_changed` - Status changed (open, resolved, pending, snoozed)
- `conversation_assigned` - Conversation assigned to agent

**Message Events:**
- `message_created` - New message received (incoming or outgoing)



#### 2. Actions

**AI-Powered Actions:**
- `ai_response` - Generate and send AI response
- `ai_summarize` - Create conversation summary note
- `ai_categorize` - Auto-categorize conversation
- `ai_sentiment_analysis` - Analyze message sentiment

**Conversation Management:**
- `change_status` - Update conversation status (open, resolved, pending, snoozed)
- `assign_agent` - Assign to specific agent or team
- `add_private_note` - Add internal note
- `add_public_note` - Add customer-visible note
- `set_priority` - Set conversation priority (low, medium, high, urgent)

**Contact Management:**
- `update_contact_attribute` - Modify contact custom attributes
- `add_contact_label` - Tag contact with labels
- `create_contact` - Create new contact if doesn't exist


#### 3. Conditions (Optional)

**Message Content:**
- Contains keywords
- Message length
- Language detection
- Sentiment score

**Contact Properties:**
- Contact attributes
- Contact labels
- Contact source
- Previous conversation count

**Conversation Properties:**
- Current status
- Current assignee
- Number of messages
- Time since last activity

### Implementation Architecture

#### Database Schema

```typescript
// Agent Model (Updated)
interface Agent {
  _id: ObjectId
  name: string
  description: string
  userId: ObjectId
  
  // Workflow Definition
  trigger: {
    type: 'conversation_created' | 'message_created' | 'conversation_status_changed' | ...
    conditions?: Condition[]
  }
  
  actions: Action[]
  
  // Execution Settings
  priority: number
  isActive: boolean
  retryOnFailure: boolean
  maxRetries: number
  
  // Analytics
  executionCount: number
  successRate: number
  avgExecutionTime: number
  
  createdAt: Date
  updatedAt: Date
}

interface Condition {
  type: 'message_contains' | 'contact_attribute' | ...
  operator: 'equals' | 'contains' | 'greater_than' | 'in' | ...
  value: any
  logicalOperator?: 'AND' | 'OR'
}

interface Action {
  type: 'ai_response' | 'change_status' | 'assign_agent' | ...
  parameters: Record<string, any>
  order: number
  continueOnFailure: boolean
}
```

#### Workflow Engine

```typescript
class WorkflowEngine {
  async processEvent(event: WebhookEvent, inboxId: string) {
    // 1. Find all agents that match this trigger
    const matchingAgents = await this.findMatchingAgents(event, inboxId)
    
    // 2. Execute agents in priority order
    for (const agent of matchingAgents) {
      if (await this.evaluateConditions(agent.trigger.conditions, event)) {
        await this.executeActions(agent.actions, event)
      }
    }
  }
  
  private async findMatchingAgents(event: WebhookEvent, inboxId: string) {
    return Agent.find({
      'inboxes': inboxId,
      'trigger.type': event.type,
      isActive: true
    }).sort({ priority: 1 })
  }
  
  private async evaluateConditions(conditions: Condition[], event: WebhookEvent): Promise<boolean> {
    // Implement condition evaluation logic
  }
  
  private async executeActions(actions: Action[], event: WebhookEvent) {
    // Execute actions in order
    for (const action of actions.sort((a, b) => a.order - b.order)) {
      await this.executeAction(action, event)
    }
  }
}
```

### Migration Strategy

#### Phase 1: Core Infrastructure
1. Update Agent model schema
2. Create WorkflowEngine service
3. Implement basic trigger matching
4. Add condition evaluation system

#### Phase 2: Action System
1. Implement core actions (change_status, assign_agent, add_note)
2. Migrate existing response agents to new system
3. Add AI-powered actions (ai_response, ai_summarize)

#### Phase 3: Advanced Features
1. Add analytics and reporting
2. Create workflow templates

#### Phase 4: UI/UX
1. Build workflow designer interface
2. Add condition builder
3. Implement action configuration
4. Create workflow testing tools

### User Experience

#### Workflow Designer
- Visual workflow builder with drag-and-drop
- Trigger selection with real-time preview
- Condition builder with autocomplete
- Action configuration with parameter validation
- Test mode to simulate workflows

#### Templates
Pre-built workflow templates:
- "Auto-responder for new conversations"
- "Escalate urgent messages to human agents"
- "Summarize long conversations"
- "Route conversations by topic"
- "Follow up on idle conversations"

### Benefits

1. **Flexibility**: Users can create complex workflows without coding
2. **Scalability**: Handle multiple automation scenarios simultaneously  
3. **Maintenance**: Easier to modify and debug specific workflows
4. **Analytics**: Track performance of individual workflows
5. **Reusability**: Share and template successful workflows

### Technical Considerations

#### Performance
- Index agents by trigger type for fast lookup
- Use event queues for async processing
- Implement circuit breakers for external calls

#### Error Handling
- Retry mechanisms for failed actions
- Dead letter queues for permanently failed workflows
- Detailed error logging and alerting

#### Security
- Validate all action parameters
- Implement permission system for sensitive actions
- Audit log all workflow executions

#### Monitoring
- Execution time metrics
- Success/failure rates
- Resource utilization tracking
- Alert on workflow failures

### API Changes

#### New Endpoints

```typescript
// Workflow Management
POST   /api/agents/workflows                 // Create workflow
GET    /api/agents/workflows                 // List workflows  
GET    /api/agents/workflows/:id             // Get workflow
PUT    /api/agents/workflows/:id             // Update workflow
DELETE /api/agents/workflows/:id             // Delete workflow

// Workflow Execution
POST   /api/agents/workflows/:id/test        // Test workflow
GET    /api/agents/workflows/:id/executions  // Get execution history
POST   /api/agents/workflows/:id/enable      // Enable workflow
POST   /api/agents/workflows/:id/disable     // Disable workflow

// Templates
GET    /api/agents/workflow-templates        // List templates
POST   /api/agents/workflow-templates/:id    // Create from template

// Metadata
GET    /api/agents/triggers                  // Available triggers
GET    /api/agents/actions                   // Available actions
GET    /api/agents/conditions                // Available conditions
```

### Backward Compatibility

- Existing response agents automatically migrated to new system
- Current API endpoints maintained with deprecation notices
- Gradual migration path with both systems running in parallel

### Success Metrics

- Number of workflows created by users
- Reduction in manual intervention required
- Improvement in response times
- User satisfaction scores
- System performance metrics

### Future Enhancements

- Machine learning for workflow optimization
- A/B testing for workflows
- Integration with business intelligence tools
- Mobile app for workflow management
- Community marketplace for workflows


## Initial Reqs:
Let's think about redesigning the agents. 
Right now, the only agent a user can create is a response agent. The response agent, Calls AI to create a response from the conversation.

I want to create a whole agent workflow process.
The agent works based off triggers, Triggers can be new conversation, new message, or any coversation event (check what is available in chatwoot).
The user can select which trigger And then what happens when the trigger is triggered.
The response agent, for example, would be a new message or and new conversation. 
And the action would be respond with an AI message. 

Other actions can be change the status, Add a note, Change a conversation attribute (get list form chatwoot), Change assignment.

