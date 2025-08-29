/**
 * GET /api/chatwoot/profile
 * 
 * Retrieves the current user's Chatwoot profile using their session cookie
 */
import axios from 'axios'
import { sanitizeText, sanitizeEmail, sanitizeUrl } from '~/utils/sanitize'

export default defineEventHandler(async (event) => {
  try {
    // Parse the Chatwoot session cookie
    const sessionCookie = getCookie(event, 'cw_d_session_info')
    
    if (!sessionCookie) {
      return {
        success: false,
        message: 'No Chatwoot session found. Please log into Chatwoot first.',
        statusCode: 401
      }
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
      console.log('Cookie type:', typeof sessionCookie)
      console.log('Cookie value:', sessionCookie)
      return {
        success: false,
        message: 'Invalid Chatwoot session cookie format',
        statusCode: 400
      }
    }

    // Extract required authentication headers
    const { 'access-token': accessToken, client, uid, expiry } = sessionData
    
    if (!accessToken || !client || !uid) {
      return {
        success: false,
        message: 'Incomplete Chatwoot session data',
        statusCode: 400
      }
    }

    // Get Chatwoot URL from environment (fallback to nginx proxy for Docker environments)
    const chatwootInstanceUrl = process.env.CHATWOOT_URL

    // Make request to Chatwoot API
    const profileUrl = `${chatwootInstanceUrl.replace(/\/$/, '')}/api/v1/profile`
    
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
      return {
        success: false,
        message: `Chatwoot API error: ${response.status}`,
        statusCode: response.status
      }
    }

    const profileData = response.data

    // Sanitize the profile data
    const sanitizedProfile = {
      id: profileData.id,
      name: sanitizeText(profileData.name || ''),
      email: sanitizeEmail(profileData.email || ''),
      avatar_url: sanitizeUrl(profileData.avatar_url) || null,
      role: sanitizeText(profileData.role || ''),
      availability_status: sanitizeText(profileData.availability_status || ''),
      auto_offline: profileData.auto_offline,
      confirmed: profileData.confirmed,
      created_at: profileData.created_at,
      updated_at: profileData.updated_at
    }

    // Extract accounts data
    const accounts = (profileData.accounts || []).map((account: any) => ({
      id: account.id,
      name: sanitizeText(account.name || ''),
      role: sanitizeText(account.role || ''),
      status: sanitizeText(account.status || ''),
      created_at: account.created_at
    }))

    return {
      success: true,
      data: {
        profile: sanitizedProfile,
        accounts: accounts,
        chatwootUrl: chatwootInstanceUrl
      }
    }

  } catch (error: any) {
    console.error('Error fetching Chatwoot profile:', error)
    
    // Handle axios errors specifically
    if (error.response) {
      return {
        success: false,
        message: `Chatwoot API error: ${error.response.status} ${error.response.statusText}`,
        statusCode: error.response.status
      }
    }
    
    return {
      success: false,
      message: 'Failed to fetch Chatwoot profile',
      statusCode: 500
    }
  }
})
