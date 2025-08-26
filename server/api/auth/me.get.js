// GET /api/auth/me
// This endpoint retrieves the authenticated user's profile information from Chatwoot.

import axios from 'axios'
import { sanitizeText, sanitizeEmail, sanitizeUrl } from '~/utils/sanitize'

export default defineEventHandler(async (event) => {
  try {
    // Parse the Chatwoot session cookie
    const sessionCookie = getCookie(event, 'cw_d_session_info')
    
    if (!sessionCookie) {
      throw createError({
        statusCode: 401,
        statusMessage: 'No Chatwoot session found. Please log into Chatwoot first.'
      })
    }

    let sessionData
    try {
      // Handle different cookie formats
      if (typeof sessionCookie === 'object') {
        // Cookie is already parsed as an object
        sessionData = sessionCookie
      } else if (typeof sessionCookie === 'string') {
        // Try to decode and parse the session cookie
        try {
          const decodedCookie = decodeURIComponent(sessionCookie)
          sessionData = JSON.parse(decodedCookie)
        } catch (parseError) {
          // If JSON parsing fails, try direct parsing
          sessionData = sessionCookie
        }
      } else {
        throw new Error('Unexpected cookie format')
      }
    } catch (e) {
      console.error('Error parsing session cookie:', e)
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Chatwoot session cookie format'
      })
    }

    // Extract required authentication headers
    const { 'access-token': accessToken, client, uid, expiry } = sessionData
    
    if (!accessToken || !client || !uid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Incomplete Chatwoot session data'
      })
    }

    // Get Chatwoot URL from environment (fallback to localhost)
    const chatwootInstanceUrl = process.env.CHATWOOT_URL || 'http://localhost:5600'
    const sanitizedChatwootUrl = sanitizeUrl(chatwootInstanceUrl)
    
    if (!sanitizedChatwootUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Invalid Chatwoot URL configuration'
      })
    }

    // Make request to Chatwoot API to validate session
    const profileUrl = `${sanitizedChatwootUrl.replace(/\/$/, '')}/api/v1/profile`
    
    const response = await axios.get(profileUrl, {
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'access-token': accessToken,
        client,
        uid,
        expiry,
      },
      validateStatus: (s) => s >= 200 && s < 500,
    })

    if (response.status !== 200) {
      console.error('Chatwoot profile API error:', response.status, response.data)
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid Chatwoot session'
      })
    }

    const profileData = response.data

    // Transform Chatwoot profile to Agent AI user format
    const userData = {
      id: profileData.id,
      name: sanitizeText(profileData.name || ''),
      email: sanitizeEmail(profileData.email || ''),
      superadmin: profileData.type === 'SuperAdmin',
      role: 'admin',      //@todo
      avatar_url: sanitizeUrl(profileData.avatar_url) || null,
      isActive: profileData.confirmed || true,
      chatwoot: {
        availability_status: sanitizeText(profileData.availability_status || ''),
        auto_offline: profileData.auto_offline,
        confirmed: profileData.confirmed,
        accounts: (profileData.accounts || []).map((account) => ({
          id: account.id,
          name: sanitizeText(account.name || ''),
          role: sanitizeText(account.role || ''),
          status: sanitizeText(account.status || ''),
        }))
      }
    }

    return {
      success: true,
      data: userData
    }
  } catch (error) {
    // Handle axios errors
    if (error.response) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Chatwoot authentication failed'
      })
    }
    
    // Re-throw createError instances
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 401,
      statusMessage: error.message || 'Authentication failed'
    })
  }
}) 