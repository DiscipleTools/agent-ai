/**
 * CSRF Token Service
 * 
 * Service for generating and validating CSRF tokens to protect against Cross-Site Request Forgery attacks.
 * Provides token generation tied to user sessions, validation methods, and request context helpers.
 */

import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { getCookie, getHeader } from 'h3'
import { sanitizeToken } from '~/utils/sanitize.js'

/**
 * CSRF Token Service
 * 
 * Provides CSRF protection by generating and validating tokens
 * that are tied to user sessions and expire after a reasonable time.
 */
class CSRFService {
  private readonly secret: string
  private readonly tokenExpiry: string = '1h' // CSRF tokens expire in 1 hour

  constructor() {
    // Use JWT_SECRET to ensure compatibility with JWT tokens
    const envSecret = process.env.JWT_SECRET
    
    if (!envSecret) {
      throw new Error('JWT_SECRET must be configured for CSRF protection')
    }
    
    this.secret = envSecret
  }

  /**
   * Generate a CSRF token for a Chatwoot user session
   * @param {string} userId - Chatwoot user ID (integer)
   * @param {string} sessionId - Session identifier (can be access token ID or session ID)
   * @returns {string} - CSRF token
   */
  generateToken(userId: string, sessionId: string): string {
    // Sanitize inputs for Chatwoot integer user IDs
    const sanitizedUserId = userId.toString()
    const sanitizedSessionId = sanitizeToken(sessionId)
    
    if (!sanitizedUserId || !/^\d+$/.test(sanitizedUserId) || !sanitizedSessionId) {
      throw new Error('Invalid userId or sessionId provided')
    }

    const payload = {
      userId: sanitizedUserId,
      sessionId: sanitizedSessionId,
      type: 'csrf',
      nonce: crypto.randomBytes(16).toString('hex'), // Add randomness
      iat: Math.floor(Date.now() / 1000)
    }

    return jwt.sign(payload, this.secret, {
      expiresIn: this.tokenExpiry,
      issuer: 'agent-ai-server',
      audience: 'agent-ai-client'
    } as jwt.SignOptions)
  }

  /**
   * Validate a CSRF token against Chatwoot user session
   * @param {string} token - CSRF token to validate
   * @param {string} userId - Expected Chatwoot user ID (integer)
   * @param {string} sessionId - Expected session identifier
   * @returns {boolean} - Whether token is valid
   */
  validateToken(token: string, userId: string, sessionId: string): boolean {
    try {
      // Sanitize inputs for Chatwoot integer user IDs
      const sanitizedToken = sanitizeToken(token)
      const sanitizedUserId = userId.toString()
      const sanitizedSessionId = sanitizeToken(sessionId)
      
      if (!sanitizedToken || !sanitizedUserId || !/^\d+$/.test(sanitizedUserId) || !sanitizedSessionId) {
        return false
      }

      const decoded = jwt.verify(sanitizedToken, this.secret, {
        issuer: 'agent-ai-server',
        audience: 'agent-ai-client'
      }) as any

      // Validate token type
      if (decoded.type !== 'csrf') {
        return false
      }

      // Validate user and session match
      return decoded.userId === sanitizedUserId && decoded.sessionId === sanitizedSessionId
    } catch (error) {
      // Token is invalid, expired, or malformed
      return false
    }
  }

  /**
   * Extract session ID from JWT access token
   * @param {string} accessToken - JWT access token
   * @returns {string|null} - Session ID or null if invalid
   */
  extractSessionId(accessToken: string): string | null {
    try {
      // Sanitize token input
      const sanitizedToken = sanitizeToken(accessToken)
      if (!sanitizedToken) {
        return null
      }

      // Use jwt.verify instead of jwt.decode for security
      const decoded = jwt.verify(sanitizedToken, this.secret) as any
      
      // For our JWT tokens, we'll use the issued at time + user ID as session identifier
      // This ensures CSRF tokens are tied to specific login sessions
      if (decoded && decoded.userId && decoded.iat) {
        const sanitizedUserId = decoded.userId.toString()
        // Validate it's a Chatwoot integer user ID
        if (sanitizedUserId && /^\d+$/.test(sanitizedUserId)) {
          return `${sanitizedUserId}-${decoded.iat}`
        }
      }
      
      return null
    } catch (error) {
      // Invalid token
      return null
    }
  }

  /**
   * Generate CSRF token from request context
   */
  generateFromRequest(event: any): string | null {
    try {
      const user = event.context.user
      if (!user || !user._id) {
        return null
      }

      // Sanitize Chatwoot user ID (integer)
      const sanitizedUserId = user._id.toString()
      if (!sanitizedUserId || !/^\d+$/.test(sanitizedUserId)) {
        return null
      }

      // Get access token from Chatwoot session cookie
      let accessToken = null
      const sessionCookie = getCookie(event, 'cw_d_session_info')
      
      if (sessionCookie) {
        try {
          let sessionData
          if (typeof sessionCookie === 'object') {
            sessionData = sessionCookie
          } else if (typeof sessionCookie === 'string') {
            const decodedCookie = decodeURIComponent(sessionCookie)
            sessionData = JSON.parse(decodedCookie)
          }
          accessToken = sessionData?.['access-token']
        } catch (error) {
          // Failed to parse session cookie
        }
      }
      
      // Fallback to headers if not found in session cookie
      if (!accessToken) {
        accessToken = getCookie(event, 'access-token') || 
                     getHeader(event, 'authorization')?.replace('Bearer ', '')
      }

      let sessionId = null

      if (accessToken) {
        // Try to extract session ID from our own JWT tokens first
        sessionId = this.extractSessionId(accessToken)
      }

      if (!sessionId) {
        // For Chatwoot sessions, generate a fallback session ID
        // Use a combination of user ID and a hash of the access token (if available)
        // This ensures sessions are unique but predictable for the same token
        if (accessToken) {
          // Create a hash of the access token to use as session identifier
          const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex').substring(0, 16)
          sessionId = `${sanitizedUserId}-cw-${tokenHash}`
        } else {
          // If no access token, use user ID with current timestamp (less secure but functional)
          const timestamp = Math.floor(Date.now() / (1000 * 60 * 60)) // Hourly session
          sessionId = `${sanitizedUserId}-fallback-${timestamp}`
        }
      }

      if (sessionId) {
        return this.generateToken(sanitizedUserId, sessionId)
      }

      // Still no session ID available - cannot generate CSRF token
      return null
    } catch (error) {
      // Error generating token
      return null
    }
  }

  /**
   * Validate CSRF token from request
   */
  validateFromRequest(event: any, token: string): boolean {
    try {
      const user = event.context.user
      if (!user || !user._id) {
        return false
      }

      // Sanitize Chatwoot user ID (integer)
      const sanitizedUserId = user._id.toString()
      if (!sanitizedUserId || !/^\d+$/.test(sanitizedUserId)) {
        return false
      }

      // Get access token from Chatwoot session cookie
      let accessToken = null
      const sessionCookie = getCookie(event, 'cw_d_session_info')
      
      if (sessionCookie) {
        try {
          let sessionData
          if (typeof sessionCookie === 'object') {
            sessionData = sessionCookie
          } else if (typeof sessionCookie === 'string') {
            const decodedCookie = decodeURIComponent(sessionCookie)
            sessionData = JSON.parse(decodedCookie)
          }
          accessToken = sessionData?.['access-token']
        } catch (error) {
          // Failed to parse session cookie
        }
      }
      
      // Fallback to headers if not found in session cookie
      if (!accessToken) {
        accessToken = getCookie(event, 'access-token') || 
                     getHeader(event, 'authorization')?.replace('Bearer ', '')
      }
      
      let sessionId = null

      if (accessToken) {
        // Try to extract session ID from our own JWT tokens first
        sessionId = this.extractSessionId(accessToken)
      }

      if (!sessionId) {
        // For Chatwoot sessions, generate the same fallback session ID as in generateFromRequest
        if (accessToken) {
          // Create a hash of the access token to use as session identifier
          const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex').substring(0, 16)
          sessionId = `${sanitizedUserId}-cw-${tokenHash}`
        } else {
          // If no access token, use user ID with current timestamp (less secure but functional)
          const timestamp = Math.floor(Date.now() / (1000 * 60 * 60)) // Hourly session
          sessionId = `${sanitizedUserId}-fallback-${timestamp}`
        }
      }

      if (sessionId) {
        return this.validateToken(token, sanitizedUserId, sessionId)
      }

      // No session ID available - cannot validate CSRF token
      return false
    } catch (error) {
      // Error validating token
      return false
    }
  }
}

// Export singleton instance
export default new CSRFService() 