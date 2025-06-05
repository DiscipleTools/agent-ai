import jwt from 'jsonwebtoken'
import User from '~/server/models/User'

export async function requireAuth(event: any) {
  const token = getCookie(event, 'access-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
  
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Access token required'
    })
  }

  try {
    // Verify token with same options as AuthService for consistency
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable not configured')
    }
    
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'agent-ai-server',
      audience: 'agent-ai-client'
    }) as any

    // Validate token type
    if (decoded.type !== 'access') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token type'
      })
    }

    const user = await User.findById(decoded.userId).select('-password -refreshTokens')

    if (!user || !user.isActive) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token'
      })
    }

    // Attach user to event context
    event.context.user = user
    return user
  } catch (error: any) {
    console.error('Token verification error:', error.message)
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid token'
    })
  }
}

export async function requireAdmin(event: any) {
  const user = event.context.user
  
  if (!user || user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required'
    })
  }
  
  return user
} 