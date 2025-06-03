# Integration Tests for Agent AI Server

## Overview
This test suite provides comprehensive integration testing for all API endpoints with a focus on **permission-based access control**. Each test verifies that endpoints are only accessible with the proper authentication and authorization.

## Test Structure

### Setup (`tests/setup.ts`)
- Creates test database connection
- Sets up test users with different roles (admin, user, inactive)
- Creates test agents with proper access controls
- Provides JWT token generation and authentication helpers

### Test Categories

#### 1. Authentication Tests (`tests/integration/auth.test.ts`)
- **POST /api/auth/login**: Valid/invalid credentials, inactive users
- **GET /api/auth/me**: Authenticated user data retrieval
- **POST /api/auth/logout**: Authentication required
- **POST /api/auth/refresh**: Token refresh validation

#### 2. User Management Tests (`tests/integration/users.test.ts`)
- **GET /api/users**: Admin-only access
- **POST /api/users/invite**: Admin-only user creation
- **PUT /api/users/[id]**: Admin-only user updates
- **DELETE /api/users/[id]**: Admin-only user deletion

#### 3. Agent Management Tests (`tests/integration/agents.test.ts`)
- **GET /api/agents**: Role-based filtering (admin sees all, users see assigned)
- **POST /api/agents**: Authenticated user creation
- **GET /api/agents/[id]**: Access control based on agent assignment
- **PUT /api/agents/[id]**: Update permissions for assigned agents only
- **DELETE /api/agents/[id]**: Delete permissions for assigned agents only

#### 4. Context Management Tests (`tests/integration/context.test.ts`)
- **GET /api/agents/[id]/context**: Agent-specific access control
- **POST /api/agents/[id]/context/url**: URL addition with permissions
- **POST /api/agents/[id]/context/test-url**: URL testing with permissions
- **POST /api/agents/[id]/context/upload**: File upload with permissions
- **DELETE /api/agents/[id]/context/[docId]**: Context deletion with permissions
- **PUT /api/agents/[id]/context/[docId]**: Context updates with permissions
- **GET /api/agents/[id]/context/[docId]**: Context access with permissions

#### 5. Settings Tests (`tests/integration/settings.test.ts`)
- **GET /api/settings**: Admin-only access
- **PUT /api/settings**: Admin-only updates
- **GET /api/settings/ai-models**: Authenticated access
- **POST /api/settings/test-ai**: Authenticated AI testing
- **POST /api/settings/test-email**: Admin-only email testing
- **GET /api/health**: Public health check

## Permission Matrix

| Endpoint | Unauthenticated | Regular User | Admin | Notes |
|----------|----------------|---------------|--------|--------|
| **Authentication** |
| POST /api/auth/login | ✅ | ✅ | ✅ | Public endpoint |
| GET /api/auth/me | ❌ | ✅ | ✅ | Requires valid token |
| POST /api/auth/logout | ❌ | ✅ | ✅ | Requires authentication |
| **User Management** |
| GET /api/users | ❌ | ❌ | ✅ | Admin only |
| POST /api/users/invite | ❌ | ❌ | ✅ | Admin only |
| PUT /api/users/[id] | ❌ | ❌ | ✅ | Admin only |
| DELETE /api/users/[id] | ❌ | ❌ | ✅ | Admin only |
| **Agent Management** |
| GET /api/agents | ❌ | ✅* | ✅ | *Filtered by access |
| POST /api/agents | ❌ | ✅ | ✅ | Creates with user access |
| GET /api/agents/[id] | ❌ | ✅* | ✅ | *Only assigned agents |
| PUT /api/agents/[id] | ❌ | ✅* | ✅ | *Only assigned agents |
| DELETE /api/agents/[id] | ❌ | ✅* | ✅ | *Only assigned agents |
| **Context Management** |
| GET /api/agents/[id]/context | ❌ | ✅* | ✅ | *Agent access required |
| POST /api/agents/[id]/context/* | ❌ | ✅* | ✅ | *Agent access required |
| PUT /api/agents/[id]/context/* | ❌ | ✅* | ✅ | *Agent access required |
| DELETE /api/agents/[id]/context/* | ❌ | ✅* | ✅ | *Agent access required |
| **Settings** |
| GET /api/settings | ❌ | ❌ | ✅ | Admin only |
| PUT /api/settings | ❌ | ❌ | ✅ | Admin only |
| GET /api/settings/ai-models | ❌ | ✅ | ✅ | Authenticated access |
| POST /api/settings/test-ai | ❌ | ✅ | ✅ | Authenticated access |
| POST /api/settings/test-email | ❌ | ❌ | ✅ | Admin only |
| **Health** |
| GET /api/health | ✅ | ✅ | ✅ | Public endpoint |

## Running the Tests

### Prerequisites
1. MongoDB running on localhost:27017 (or set TEST_DB_URI environment variable)
2. Nuxt dev server running on localhost:3000
3. Environment variables set (JWT_SECRET, etc.)

### Commands
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest tests/integration/auth.test.ts
```

### Environment Setup
Create a `.env.test` file or set environment variables:
```bash
TEST_DB_URI=mongodb://localhost:27017/agent-ai-test
JWT_SECRET=your-test-jwt-secret
```

## Test Data

### Test Users
- **Admin**: `admin@test.com` (password: `password123`)
  - Role: admin
  - Can access all endpoints and agents

- **Regular User**: `user@test.com` (password: `password123`)
  - Role: user
  - Can only access assigned agents
  - Has access to "User Agent" only

- **Inactive User**: `inactive@test.com` (password: `password123`)
  - Role: user
  - isActive: false
  - Should be rejected for all authenticated endpoints

### Test Agents
- **Public Agent**: Created by admin, not assigned to regular user
- **User Agent**: Created by user, assigned to regular user

## Security Validations

Each test validates:
1. **Authentication**: Valid JWT token required
2. **Authorization**: Role-based access (admin vs user)
3. **Resource Access**: Users can only access assigned agents
4. **Data Isolation**: Users can't access other users' data
5. **Admin Privileges**: Admin-only operations are protected

## Expected Failures
If any tests fail, it indicates:
- Missing authentication checks
- Incorrect permission validation
- Role-based access control issues
- Security vulnerabilities in the API

## Adding New Tests
When adding new endpoints:
1. Add tests to the appropriate category file
2. Test all permission levels (unauthenticated, user, admin)
3. Verify data isolation for multi-tenant features
4. Update this documentation 