/**
 * CSRF Protection Middleware
 * 
 * Validates CSRF tokens on state-changing HTTP methods (POST, PUT, DELETE, PATCH)
 * to prevent Cross-Site Request Forgery attacks.
 */

import { requireAuth } from '~/server/utils/auth'
import csrfService from '~/server/services/csrfService'

export default defineEventHandler(async (event) => {
  // Only apply CSRF protection to API routes
  if (!event.node.req.url?.startsWith('/api/')) {
    return
  }

  const method = event.method
  
  // Only check CSRF tokens for state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return
  }

  // Skip CSRF check for certain endpoints that don't require it
  const skipCSRFPaths = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/setup-account',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/validate-reset-token',
    '/api/users/complete-setup',
    '/api/users/validate-invitation',
    '/api/health',
    '/api/rag/health',
    '/api/rag/test-connection'
  ]

  const requestPath = event.node.req.url?.split('?')[0] || ''
  
  if (skipCSRFPaths.some(path => requestPath === path)) {
    return
  }

  // Also skip for webhook endpoints (they have their own authentication)
  if (requestPath.startsWith('/api/webhook/')) {
    return
  }

  try {
    // Require authentication first - CSRF only applies to authenticated requests
    await requireAuth(event)

    // Get CSRF token from headers or body
    let csrfToken = getHeader(event, 'x-csrf-token') || 
                   getHeader(event, 'x-xsrf-token')

    if (!csrfToken) {
      // Try to get from request body if it's a form submission
      try {
        const body = await readBody(event)
        csrfToken = body?.csrfToken || body?._token
      } catch (error) {
        // Body reading failed or not present - this is normal for multipart form data
        // For multipart forms, we rely on the header method only
        console.log('CSRF middleware: Could not read body (likely multipart form data)')
      }
    }

    if (!csrfToken) {
      throw createError({
        statusCode: 403,
        statusMessage: 'CSRF token required for this request'
      })
    }

    // Validate CSRF token
    const isValidToken = csrfService.validateFromRequest(event, csrfToken)

    if (!isValidToken) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Invalid or expired CSRF token'
      })
    }

    // CSRF token is valid, continue with request
  } catch (error: any) {
    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // For authentication errors, let them pass through
    if (error.statusCode === 401) {
      throw error
    }

    // For other errors, treat as CSRF validation failure
    throw createError({
      statusCode: 403,
      statusMessage: 'CSRF validation failed'
    })
  }
}) 