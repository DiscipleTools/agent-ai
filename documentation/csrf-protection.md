# CSRF Protection Implementation

This document describes the Cross-Site Request Forgery (CSRF) protection implemented in the Agent AI application.

## Overview

CSRF protection prevents attackers from performing unauthorized actions on behalf of authenticated users by ensuring that state-changing requests include a valid CSRF token that only the legitimate application can generate.

## Implementation Components

### 1. Server-Side Components

#### CSRF Service (`server/services/csrfService.ts`)
- **JWT-based tokens**: Uses JWT tokens signed with a secret for strong security
- **Session binding**: Tokens are tied to specific user sessions for additional security
- **Token expiration**: CSRF tokens expire after 1 hour

#### CSRF Middleware (`server/middleware/csrf.ts`)
- **Automatic validation**: Validates CSRF tokens on all POST, PUT, DELETE, PATCH requests
- **Smart skipping**: Bypasses CSRF for authentication endpoints and webhooks
- **Multiple sources**: Accepts tokens from headers (`X-CSRF-Token`) or request body (`csrfToken`)
- **Error handling**: Returns 403 errors for invalid/missing tokens

#### CSRF Token Endpoint (`server/api/auth/csrf-token.get.ts`)
- **Authenticated access**: Requires valid JWT authentication
- **Fresh tokens**: Generates new CSRF tokens on demand
- **Consistent format**: Returns tokens in standard API response format

### 2. Client-Side Components

#### CSRF Composable (`composables/useCsrf.js`)
- **Token management**: Handles fetching, caching, and refreshing CSRF tokens
- **Automatic injection**: Provides helpers to add tokens to requests
- **Error recovery**: Automatically refreshes expired tokens
- **Form integration**: Helpers for adding tokens to form data

#### Enhanced API Composable (`composables/useApi.js`)
- **Automatic inclusion**: Adds CSRF tokens to state-changing requests automatically
- **Smart detection**: Only includes tokens when needed (POST/PUT/DELETE/PATCH)
- **Token caching**: Caches tokens to avoid unnecessary requests
- **Error handling**: Clears cached tokens on 403 errors

#### Component Integration (`components/Agent/AgentForm.vue`)
- **Form protection**: All form submissions include CSRF tokens
- **File uploads**: File upload requests include CSRF protection
- **Context operations**: Document management operations are CSRF-protected

### 3. Authentication Integration

#### Auth Store Updates (`stores/auth.js`)
- **Cache clearing**: Clears CSRF cache on login/logout
- **Session consistency**: Ensures fresh tokens for new sessions

## Security Features

### Token Binding
- **User-specific**: Tokens are bound to specific user IDs
- **Session-specific**: Tokens include session identifiers from JWT tokens
- **Time-limited**: Tokens expire after 1 hour to limit exposure

### Defense in Depth
- **Multiple validation layers**: Server middleware + individual endpoint validation
- **Token rotation**: New tokens generated on each request when needed
- **Secure transmission**: Tokens transmitted via secure headers

### Attack Prevention
- **Cross-origin protection**: Prevents attacks from malicious sites
- **Replay attack mitigation**: Time-limited tokens with nonces
- **Session hijacking protection**: Tokens tied to specific sessions

## Configuration

### Environment Variables
```bash
# CSRF secret (automatically generated in production)
CSRF_SECRET=your-csrf-secret-here
```

### Skipped Endpoints
The following endpoints bypass CSRF protection:
- `/api/auth/login` - Initial authentication
- `/api/auth/refresh` - Token refresh
- `/api/auth/logout` - Logout (already authenticated)
- `/api/auth/setup-account` - Account setup
- `/api/users/complete-setup` - User onboarding
- `/api/users/validate-invitation` - Invitation validation
- `/api/health` - Health checks
- `/api/rag/health` - RAG health checks
- `/api/rag/test-connection` - Connection testing
- `/api/webhook/*` - Webhook endpoints (have separate auth)

## Usage Examples

### Automatic Protection (Recommended)
```javascript
// The useApi composable automatically includes CSRF tokens
const { $api } = useApi()

// This automatically includes CSRF token
await $api('/api/agents', {
  method: 'POST',
  body: agentData
})
```

### Manual Token Management
```javascript
// Using the CSRF composable directly
const { csrfRequest, getCsrfToken } = useCsrf()

// Make a CSRF-protected request
await csrfRequest('/api/agents', {
  method: 'POST',
  body: agentData
})

// Add token to form data
const token = await getCsrfToken()
formData.csrfToken = token
```

### Form Integration
```javascript
// Add CSRF token to form data
const { addCsrfToForm } = useCsrf()

const secureFormData = await addCsrfToForm(formData)
// Now secureFormData includes csrfToken
```

## Error Handling

### Client-Side Errors
- **403 Forbidden**: Invalid or missing CSRF token
- **Token refresh**: Automatic retry with fresh token
- **Graceful degradation**: Meaningful error messages

### Server-Side Validation
- **Missing token**: Returns 403 with clear error message
- **Invalid token**: Returns 403 with security-safe error message
- **Expired token**: Returns 403, client refreshes automatically

## Testing Considerations

### Development
- CSRF protection is fully active in development
- Use provided composables for consistent behavior
- Debug CSRF issues using browser network tab

### Production
- Secure secrets automatically generated during deployment
- CSRF tokens use production-grade cryptography
- Full protection against CSRF attacks

## Security Best Practices

### Token Handling
- **Never log tokens**: Tokens should not appear in logs
- **Secure transmission**: Always use HTTPS in production
- **Short expiration**: 1-hour token lifetime limits exposure

### Implementation Guidelines
- **Use composables**: Always use provided `useCsrf()` or `useApi()`
- **Check responses**: Handle 403 errors appropriately
- **Test thoroughly**: Verify CSRF protection in all forms

### Monitoring
- **Failed attempts**: Monitor 403 errors for potential attacks
- **Token generation**: Track unusual token generation patterns
- **Performance**: Monitor impact of CSRF validation on response times

## Troubleshooting

### Common Issues

1. **403 Errors in Forms**
   - Ensure form uses `useCsrf()` composable
   - Check that token is included in request
   - Verify user is authenticated

2. **Token Not Generated**
   - Check authentication status
   - Verify CSRF endpoint is accessible
   - Check browser console for errors

3. **Token Expired**
   - Normal behavior after 1 hour
   - Client should automatically refresh
   - Check token refresh logic

### Debug Steps

1. **Check token presence**:
   ```javascript
   const { csrfToken } = useCsrf()
   console.log('CSRF Token:', csrfToken.value)
   ```

2. **Verify token validity**:
   - Check browser network tab
   - Look for `X-CSRF-Token` header
   - Verify token format (JWT vs simple)

3. **Test endpoint manually**:
   ```bash
   curl -X POST https://your-domain.com/api/agents \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Agent"}'
   ```

## Migration Guide

### Existing Forms
1. Import CSRF composable: `const { addCsrfToForm } = useCsrf()`
2. Add to form submission: `const secureData = await addCsrfToForm(formData)`
3. Use secure data in API call

### Custom API Calls
1. Use `useApi()` composable instead of direct `$fetch`
2. Or use `csrfRequest()` from `useCsrf()`
3. Handle 403 errors appropriately

### File Uploads
1. Use `addCsrfToForm()` for FormData objects
2. Ensure multipart forms include token
3. Server automatically validates token

## Performance Impact

### Client-Side
- **Token caching**: Minimal impact due to caching
- **Single request**: One additional request per session
- **Automatic retry**: Minimal delay on token refresh

### Server-Side
- **JWT validation**: Fast cryptographic operations
- **Database-free**: No additional database queries
- **Middleware efficiency**: Early validation in request pipeline

The CSRF protection provides strong security with minimal performance impact and integrates seamlessly with the existing authentication system. 