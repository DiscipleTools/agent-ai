# Centralized Permission Management System

This document describes the centralized permission management system for the Agent AI application, which follows Nuxt 3 patterns and provides consistent access control across all API endpoints.

## Overview

The permission system is built around these core concepts:

- **Authentication**: Verifying user identity via JWT tokens
- **Authorization**: Checking if authenticated users have permission for specific actions
- **Permission Checkers**: Reusable objects that encapsulate permission logic
- **Middleware Composers**: Higher-order functions that wrap handlers with permission checks

## Core Components

### 1. Permission Constants

```typescript
import { PERMISSIONS } from '~/server/utils/auth'

// Available permissions
PERMISSIONS.AGENT.READ        // Read agent data
PERMISSIONS.AGENT.WRITE       // Update agent
PERMISSIONS.AGENT.DELETE      // Delete agent
PERMISSIONS.AGENT.CREATE      // Create new agent

PERMISSIONS.CONTEXT.READ      // Read context documents
PERMISSIONS.CONTEXT.WRITE     // Update context documents
PERMISSIONS.CONTEXT.DELETE    // Delete context documents
PERMISSIONS.CONTEXT.CREATE    // Add context documents

PERMISSIONS.USER.READ         // View user data (admin only)
PERMISSIONS.USER.WRITE        // Update users (admin only)
PERMISSIONS.USER.DELETE       // Delete users (admin only)
PERMISSIONS.USER.CREATE       // Create/invite users (admin only)

PERMISSIONS.SETTINGS.READ     // View settings (admin only)
PERMISSIONS.SETTINGS.WRITE    // Update settings (admin only)

PERMISSIONS.RAG.READ          // View RAG stats
PERMISSIONS.RAG.SEARCH        // Search RAG data
```

### 2. Permission Checker

The `PermissionChecker` interface provides a consistent way to check permissions:

```typescript
interface PermissionChecker {
  user: any
  hasRole(role: string): boolean
  hasAgentAccess(agentId: string): boolean
  canAccessResource(permission: string, context?: PermissionContext): boolean
}
```

### 3. Permission Context

Context provides additional information for permission checks:

```typescript
interface PermissionContext {
  agentId?: string
  userId?: string
  resourceOwnerId?: string
  [key: string]: any
}
```

## Usage Patterns

### Basic Authentication

```typescript
// Old way (still supported)
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  // ... handle request
})

// New way with permission checker
export default defineEventHandler(async (event) => {
  const checker = await requireAuthWithChecker(event)
  
  if (checker.hasRole('admin')) {
    // Admin-specific logic
  }
  
  // ... handle request
})
```

### Agent Access Control

```typescript
// Method 1: Using requireAgentAccess (recommended)
export default defineEventHandler(async (event) => {
  const agentId = getRouterParam(event, 'id')
  const checker = await requireAgentAccess(event, agentId, 'read')
  
  // User has access to read this agent
  // ... handle request
})

// Method 2: Using requirePermission
export default defineEventHandler(async (event) => {
  const agentId = getRouterParam(event, 'id')
  const checker = await requirePermission(event, PERMISSIONS.AGENT.READ, { agentId })
  
  // ... handle request
})

// Method 3: Using middleware composer (cleanest)
export default authMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  // agentId is automatically extracted and validated
  // checker has already verified access
  // ... handle request
})
```

### Admin-Only Endpoints

```typescript
// Method 1: Traditional
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  await requireAdmin(event)
  
  // ... admin logic
})

// Method 2: Using middleware composer (recommended)
export default authMiddleware.admin(async (event, checker) => {
  // User is guaranteed to be admin
  // ... admin logic
})
```

### Complex Permission Checks

```typescript
export default defineEventHandler(async (event) => {
  const checker = await requireAuthWithChecker(event)
  
  // Multiple checks
  if (!checker.hasRole('admin') && !checker.hasAgentAccess(agentId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied'
    })
  }
  
  // Or use the permission system
  const hasAccess = checker.canAccessResource(PERMISSIONS.AGENT.WRITE, { agentId })
  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied'
    })
  }
})
```

## Migration Guide

### Before (Scattered Permission Checks)

```typescript
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const agentId = getRouterParam(event, 'id')
  
  if (!agentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Agent ID is required'
    })
  }
  
  // Scattered permission logic
  if (user.role !== 'admin' && !user.agentAccess?.includes(new mongoose.Types.ObjectId(agentId))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied to this agent'
    })
  }
  
  // ... business logic
})
```

### After (Centralized Permissions)

```typescript
// Option 1: Using helper functions
export default defineEventHandler(async (event) => {
  const agentId = getRequiredAgentId(event) // Validates and extracts ID
  const checker = await requireAgentAccess(event, agentId, 'read')
  
  // ... business logic
})

// Option 2: Using middleware composer (recommended)
export default authMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  // All validation and permission checks are done
  // ... business logic
})
```

## Benefits

### 1. Consistency
- All permission checks follow the same pattern
- Centralized logic reduces bugs and inconsistencies
- Easy to audit and maintain access control

### 2. Maintainability
- Permission logic is in one place
- Easy to modify permission rules
- Clear separation of concerns

### 3. Security
- Reduces risk of missing permission checks
- Standardized error messages prevent information leakage
- Input validation built into helper functions

### 4. Developer Experience
- IntelliSense support with TypeScript interfaces
- Reusable patterns reduce boilerplate
- Clear documentation and examples

## Permission Matrix

| Resource | Operation | Admin | Agent Owner | Other Users |
|----------|-----------|--------|-------------|-------------|
| **Agents** |
| List all | GET /api/agents | ✅ All | ✅ Assigned only | ✅ Assigned only |
| View specific | GET /api/agents/[id] | ✅ | ✅ If assigned | ❌ |
| Create | POST /api/agents | ✅ | ✅ | ✅ |
| Update | PUT /api/agents/[id] | ✅ | ✅ If assigned | ❌ |
| Delete | DELETE /api/agents/[id] | ✅ | ✅ If assigned | ❌ |
| **Context Documents** |
| List | GET /api/agents/[id]/context | ✅ | ✅ If agent assigned | ❌ |
| Add | POST /api/agents/[id]/context/* | ✅ | ✅ If agent assigned | ❌ |
| Update | PUT /api/agents/[id]/context/[docId] | ✅ | ✅ If agent assigned | ❌ |
| Delete | DELETE /api/agents/[id]/context/[docId] | ✅ | ✅ If agent assigned | ❌ |
| **RAG System** |
| Search | POST /api/agents/[id]/rag/search | ✅ | ✅ If agent assigned | ❌ |
| Stats | GET /api/agents/[id]/rag/stats | ✅ | ✅ If agent assigned | ❌ |
| **User Management** |
| List users | GET /api/users | ✅ | ❌ | ❌ |
| Create user | POST /api/users/invite | ✅ | ❌ | ❌ |
| Update user | PUT /api/users/[id] | ✅ | ❌ | ❌ |
| Delete user | DELETE /api/users/[id] | ✅ | ❌ | ❌ |
| **Settings** |
| View settings | GET /api/settings | ✅ | ❌ | ❌ |
| Update settings | PUT /api/settings | ✅ | ❌ | ❌ |

## Examples in Practice

### Agent CRUD Endpoint

```typescript
// server/api/agents/[id].get.ts
export default authMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  // Permission check already done, agentId validated
  const agent = await Agent.findById(agentId).populate('createdBy', 'name email')
  
  if (!agent) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Agent not found'
    })
  }
  
  return { success: true, data: agent }
})
```

### Context Document Management

```typescript
// server/api/agents/[id]/context/upload.post.ts
export default authMiddleware.agentAccess('write')(async (event, checker, agentId) => {
  const agent = await Agent.findById(agentId)
  if (!agent) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Agent not found'
    })
  }
  
  // Handle file upload...
  // Permission to modify agent context already verified
})
```

### Admin-Only Settings

```typescript
// server/api/settings/index.get.ts
export default authMiddleware.admin(async (event, checker) => {
  // Only admins can reach this point
  const settings = await Settings.findOne()
  return { success: true, data: settings }
})
```

## Testing Permissions

The permission system integrates with the existing test suite:

```typescript
// In tests
describe('Agent API with new permissions', () => {
  it('should allow agent access via new system', async () => {
    // Test using the centralized permission system
    const headers = getAuthHeaders('user')
    const response = await $fetch(`/api/agents/${userAgentId}`, { headers })
    expect(response.success).toBe(true)
  })
})
```

## Backward Compatibility

The new system maintains full backward compatibility:

- Existing `requireAuth()` and `requireAdmin()` functions work unchanged
- Existing permission checks continue to work
- Migration can be done gradually, endpoint by endpoint
- No breaking changes to existing APIs

## Future Enhancements

The permission system is designed to be extensible:

1. **Resource-specific permissions**: Add granular permissions per resource type
2. **Role-based access control**: Extend beyond admin/user to custom roles
3. **Permission caching**: Cache permission checks for better performance
4. **Audit logging**: Log all permission checks for security auditing
5. **Dynamic permissions**: Load permissions from database for runtime changes 