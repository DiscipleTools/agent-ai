/**
 * CSRF Token Service
 * 
 * Service for generating and validating CSRF tokens to protect against Cross-Site Request Forgery attacks.
 * Provides token generation tied to user sessions, validation methods, and request context helpers.
 */

import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { getCookie, getHeader } from 'h3'
import { sanitizeToken, sanitizeObjectId } from '~/utils/sanitize.js'

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
   * Generate a CSRF token for a user session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session identifier (can be access token ID or session ID)
   * @returns {string} - CSRF token
   */
  generateToken(userId: string, sessionId: string): string {
    // For Chatwoot authentication, we don't need MongoDB ObjectId validation
    // Just ensure the inputs are valid strings
    if (!userId || !sessionId || typeof userId !== 'string' || typeof sessionId !== 'string') {
      throw new Error('Invalid userId or sessionId provided')
    }
    
    const sanitizedUserId = userId.toString()
    const sanitizedSessionId = sanitizeToken(sessionId)
    
    if (!sanitizedSessionId) {
      throw new Error('Invalid sessionId provided')
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
   * Validate a CSRF token against user session
   * @param {string} token - CSRF token to validate
   * @param {string} userId - Expected user ID
   * @param {string} sessionId - Expected session identifier
   * @returns {boolean} - Whether token is valid
   */
  validateToken(token: string, userId: string, sessionId: string): boolean {
    try {
      // Sanitize inputs
      const sanitizedToken = sanitizeToken(token)
      
      // For Chatwoot authentication, we don't need MongoDB ObjectId validation
      if (!userId || !sessionId || typeof userId !== 'string' || typeof sessionId !== 'string') {
        return false
      }
      
      const sanitizedUserId = userId.toString()
      const sanitizedSessionId = sanitizeToken(sessionId)
      
      if (!sanitizedToken || !sanitizedSessionId) {
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
        const sanitizedUserId = sanitizeObjectId(decoded.userId.toString())
        if (sanitizedUserId) {
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
      
      if (!user || !user._id && !user.id) {
        return null
      }

      // For Chatwoot authentication, use the user ID directly
      const userId = user._id?.toString() || user.id?.toString()
      
      // For Chatwoot users, we don't need MongoDB ObjectId validation
      // Just ensure it's a valid string/number
      if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
        return null
      }
      
      const sanitizedUserId = userId.toString()

      // For Chatwoot sessions, check for the session cookie
      const chatwootSession = getCookie(event, 'cw_d_session_info')
      
      if (chatwootSession) {
        // Use a hash of the Chatwoot session as the session ID
        const sessionId = crypto.createHash('sha256').update(JSON.stringify(chatwootSession)).digest('hex').substring(0, 32)
        return this.generateToken(sanitizedUserId, sessionId)
      }

      // Fallback to old JWT method for compatibility
      const accessToken = getCookie(event, 'access-token') || 
                         getHeader(event, 'authorization')?.replace('Bearer ', '')

      if (accessToken) {
        const sessionId = this.extractSessionId(accessToken)
        if (sessionId) {
          return this.generateToken(sanitizedUserId, sessionId)
        }
      }

      // No session ID available - cannot generate CSRF token
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
      if (!user || !user._id && !user.id) {
        return false
      }

      // For Chatwoot authentication, use the user ID directly
      const userId = user._id?.toString() || user.id?.toString()
      
      // For Chatwoot users, we don't need MongoDB ObjectId validation
      if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
        return false
      }
      
      const sanitizedUserId = userId.toString()

      // For Chatwoot sessions, check for the session cookie
      const chatwootSession = getCookie(event, 'cw_d_session_info')
      if (chatwootSession) {
        // Use a hash of the Chatwoot session as the session ID
        const sessionId = crypto.createHash('sha256').update(JSON.stringify(chatwootSession)).digest('hex').substring(0, 32)
        return this.validateToken(token, sanitizedUserId, sessionId)
      }

      // Fallback to old JWT method for compatibility
      const accessToken = getCookie(event, 'access-token') || 
                         getHeader(event, 'authorization')?.replace('Bearer ', '')
      
      if (accessToken) {
        const sessionId = this.extractSessionId(accessToken)
        if (sessionId) {
          return this.validateToken(token, sanitizedUserId, sessionId)
        }
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