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
    const decoded = jwt.verify(token, useRuntimeConfig().jwtSecret) as any
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
  } catch (error) {
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