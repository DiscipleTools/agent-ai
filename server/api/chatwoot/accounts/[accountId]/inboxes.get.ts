/**
 * GET /api/chatwoot/accounts/[accountId]/inboxes
 * 
 * Retrieves inboxes for a specific Chatwoot account using the user's session cookie
 */
import axios from 'axios'
import { sanitizeText, sanitizeUrl } from '~/utils/sanitize'

export default defineEventHandler(async (event) => {
  try {
    const accountId = getRouterParam(event, 'accountId')
    
    if (!accountId || isNaN(Number(accountId))) {
      return {
        success: false,
        message: 'Invalid account ID',
        statusCode: 400
      }
    }

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

    // Get Chatwoot URL from environment (fallback to localhost)
    const chatwootInstanceUrl = process.env.CHATWOOT_URL || 'http://localhost:5500'
    const sanitizedChatwootUrl = sanitizeUrl(chatwootInstanceUrl)
    
    if (!sanitizedChatwootUrl) {
      return {
        success: false,
        message: 'Invalid Chatwoot URL configuration',
        statusCode: 500
      }
    }

    // Make request to Chatwoot API for inboxes
    const inboxesUrl = `${sanitizedChatwootUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/inboxes`
    
    const response = await axios.get(inboxesUrl, {
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
      console.error('Chatwoot inboxes API error:', response.status, response.data)
      return {
        success: false,
        message: `Chatwoot API error: ${response.status}`,
        statusCode: response.status
      }
    }

    const inboxesData = response.data

    // Sanitize the inboxes data
    const sanitizedInboxes = (inboxesData.payload || inboxesData || []).map((inbox: any) => ({
      id: inbox.id,
      name: sanitizeText(inbox.name || ''),
      channel_type: sanitizeText(inbox.channel_type || ''),
      phone_number: sanitizeText(inbox.phone_number || ''),
      website_url: sanitizeUrl(inbox.website_url) || null,
      welcome_title: sanitizeText(inbox.welcome_title || ''),
      welcome_tagline: sanitizeText(inbox.welcome_tagline || ''),
      web_widget_script: null, // Don't include script content for security
      website_token: sanitizeText(inbox.website_token || ''),
      enable_auto_assignment: inbox.enable_auto_assignment,
      enable_email_collect: inbox.enable_email_collect,
      callback_webhook_url: sanitizeUrl(inbox.callback_webhook_url) || null,
      created_at: inbox.created_at,
      updated_at: inbox.updated_at
    }))

    return {
      success: true,
      data: sanitizedInboxes
    }

  } catch (error: any) {
    console.error('Error fetching Chatwoot inboxes:', error)
    
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
      message: 'Failed to fetch Chatwoot inboxes',
      statusCode: 500
    }
  }
})
