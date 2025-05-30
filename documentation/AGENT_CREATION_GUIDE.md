# Agent Creation Guide

## Overview

This guide explains how to create and manage AI agents in the Agent AI Server. The system provides a complete CRUD interface for managing agents with custom prompts, settings, and context documents.

## 🔧 Recent Fix: User Permissions Issue

**Problem**: Users were not automatically granted access to agents they created, causing newly created agents to not appear in their agents list.

**Root Cause**: The agent creation endpoint was not updating the user's `agentAccess` array when creating a new agent.

**Solution**: Updated `server/api/agents/index.post.ts` to automatically grant the creating user access to their new agent by adding the agent ID to their `agentAccess` array.

**Code Change**:
```javascript
// Grant the creating user access to the new agent (unless they're admin - admins have access to all)
if (user.role !== 'admin') {
  await User.findByIdAndUpdate(
    user._id,
    { $addToSet: { agentAccess: agent._id } },
    { new: true }
  )
}
```

**Impact**: Now when users create agents, they will automatically appear in their agents list.

## Features Implemented

### 1. Agent Creation UI
- **Location**: `/dashboard/agents/create`
- **Components**: 
  - `pages/dashboard/agents/create.vue` - Create agent page
  - `components/Agent/AgentForm.vue` - Reusable form component
- **Features**:
  - Form validation with real-time feedback
  - Character counters for text fields
  - AI settings configuration (temperature, max tokens, response delay)
  - Toast notifications for success/error states

### 2. Agent Editing UI
- **Location**: `/dashboard/agents/[id]`
- **Components**: 
  - `pages/dashboard/agents/[id].vue` - Edit agent page
  - Uses the same `AgentForm.vue` component
- **Features**:
  - Pre-populated form with existing agent data
  - Same validation and settings as creation
  - Context documents management (placeholder for future implementation)

### 3. Agent Management
- **Location**: `/dashboard/agents`
- **Components**: 
  - `pages/dashboard/agents/index.vue` - Agents list page
- **Features**:
  - Grid view of all agents
  - Agent status indicators (Active/Inactive)
  - Webhook URL display with copy functionality
  - Edit and delete actions
  - Empty state for new users

## Backend API

### Create Agent Endpoint
- **URL**: `POST /api/agents`
- **File**: `server/api/agents/index.post.ts`
- **Features**:
  - Enhanced validation matching frontend rules
  - Automatic webhook URL generation
  - User association and permissions
  - Comprehensive error handling

### Validation Rules

#### Agent Name
- Required field
- Maximum 100 characters
- Trimmed of whitespace

#### Description
- Optional field
- Maximum 500 characters

#### System Prompt
- Required field
- Minimum 10 characters
- Maximum 2000 characters

#### AI Settings
- **Temperature**: 0.0 to 1.0 (default: 0.7)
- **Max Tokens**: 1 to 2000 (default: 500)
- **Response Delay**: 0 to 30 seconds (default: 0)

## Data Flow

1. **User Input**: User fills out the agent creation form
2. **Frontend Validation**: Real-time validation with error messages
3. **Form Submission**: Data sent to backend API
4. **Backend Validation**: Server-side validation with enhanced rules
5. **Database Storage**: Agent saved to MongoDB with auto-generated webhook URL
6. **Response**: Success/error response with appropriate toast notification
7. **Navigation**: Redirect to agents list on success

## State Management

### Agents Store (`stores/agents.js`)
- `createAgent(agentData)` - Creates new agent
- `updateAgent(id, agentData)` - Updates existing agent
- `fetchAgents()` - Retrieves all agents
- `fetchAgent(id)` - Retrieves single agent
- `deleteAgent(id)` - Deletes agent

## UI Components

### AgentForm Component
- **Props**: `agent` (optional, for editing)
- **Events**: `submit`, `cancel`
- **Features**:
  - Reactive form with validation
  - Character counters
  - Loading states
  - Error handling
  - Responsive design with dark mode support

## Usage Instructions

### Creating a New Agent

1. Navigate to `/dashboard/agents`
2. Click "Create Agent" button
3. Fill out the form:
   - **Agent Name**: Give your agent a descriptive name
   - **Description**: Optional description of the agent's purpose
   - **System Prompt**: Define the agent's behavior and personality
   - **AI Settings**: Configure temperature, max tokens, and response delay
4. Click "Create Agent" to save
5. You'll be redirected to the agents list with a success message

### Editing an Agent

1. Navigate to `/dashboard/agents`
2. Click "Edit" on any agent card
3. Modify the form fields as needed
4. Click "Update Agent" to save changes
5. You'll be redirected to the agents list with a success message

### Managing Agents

- **View Webhook URL**: Each agent has a unique webhook URL displayed on its card
- **Copy Webhook URL**: Click the copy icon to copy the webhook URL to clipboard
- **Delete Agent**: Click "Delete" and confirm to remove an agent
- **Agent Status**: See if an agent is Active or Inactive

## Technical Notes

### Webhook URL Generation
- Automatically generated using crypto.randomBytes(16).toString('hex')
- Format: `/webhook/agent/{randomId}`
- Unique per agent and used for Chatwoot integration

### Authentication
- All agent operations require authentication
- Users can only manage agents they have access to
- Admin users can manage all agents

### Error Handling
- Frontend validation prevents invalid submissions
- Backend validation provides detailed error messages
- Toast notifications inform users of success/failure
- Loading states provide visual feedback

## Future Enhancements

### Context Documents (Placeholder)
- File upload functionality for PDFs, text files, etc.
- URL-based context addition
- Context document management (add/remove)

### Advanced Features
- Agent analytics and performance metrics
- Bulk operations (enable/disable multiple agents)
- Agent templates and cloning
- Advanced AI model selection
- Custom webhook configurations

## Files Modified/Created

### Frontend
- `pages/dashboard/agents/create.vue` - New agent creation page
- `pages/dashboard/agents/[id].vue` - New agent editing page
- `pages/dashboard/agents/index.vue` - Updated with navigation
- `components/Agent/AgentForm.vue` - New reusable form component

### Backend
- `server/api/agents/index.post.ts` - Enhanced with better validation
- `server/models/Agent.js` - Existing model with validation rules

### State Management
- `stores/agents.js` - Existing store with CRUD operations

This implementation provides a solid foundation for agent management with room for future enhancements and integrations. 