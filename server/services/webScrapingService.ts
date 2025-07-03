import { JSDOM } from 'jsdom'
import validator from 'validator'
import sanitizeHtml from 'sanitize-html'
import urlParse from 'url-parse'
import { extract } from '@extractus/article-extractor'

interface ScrapedContent {
  content: string
  title?: string
  url: string
  contentType: string
  scrapedAt: Date
}

interface WebsiteContent {
  baseUrl: string
  pages: ScrapedContent[]
  totalPages: number
  totalContentLength: number
  scrapedAt: Date
  summary: string
}

interface CrawlOptions {
  maxPages?: number
  maxDepth?: number
  sameDomainOnly?: boolean
  includePatterns?: string[]
  excludePatterns?: string[]
  respectRobotsTxt?: boolean
}

interface ScrapingOptions {
  maxContentLength?: number
  timeout?: number
  userAgent?: string
  allowedDomains?: string[]
  blockedDomains?: string[]
}

class WebScrapingService {
  private readonly defaultOptions: ScrapingOptions = {
    maxContentLength: 1000000, // 500KB max content (increased from 150KB)
    timeout: 30000, // 30 seconds
    userAgent: 'Agent-AI-Server/1.0 (+https://github.com/agent-ai-server)',
    allowedDomains: [],
    blockedDomains: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'tiktok.com'
    ]
  }

  private readonly defaultCrawlOptions: CrawlOptions = {
    maxPages: 50,
    maxDepth: 2,
    sameDomainOnly: true,
    includePatterns: [],
    excludePatterns: [
      '/admin',
      '/login',
      '/register',
      '/cart',
      '/checkout',
      '/account',
      '/profile',
      '.pdf',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.svg',
      '.css',
      '.js',
      '.xml',
      '.json'
    ],
    respectRobotsTxt: true
  }

  /**
   * Validate and sanitize URL
   */
  private validateUrl(url: string): { isValid: boolean; error?: string; normalizedUrl?: string } {
    try {
      // Basic URL validation
      if (!validator.isURL(url, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true,
        allow_underscores: false,
        allow_trailing_dot: false,
        allow_protocol_relative_urls: false
      })) {
        return { isValid: false, error: 'Invalid URL format' }
      }

      const parsedUrl = urlParse(url, true)
      
      // Check for blocked domains
      const hostname = parsedUrl.hostname?.toLowerCase()
      if (!hostname) {
        return { isValid: false, error: 'Invalid hostname' }
      }

      // Check against blocked domains
      for (const blockedDomain of this.defaultOptions.blockedDomains!) {
        if (hostname === blockedDomain || hostname.endsWith(`.${blockedDomain}`)) {
          return { isValid: false, error: `Domain ${hostname} is not allowed` }
        }
      }

      // Check for private/local IP addresses
      if (this.isPrivateIP(hostname)) {
        return { isValid: false, error: 'Private IP addresses are not allowed' }
      }

      // Normalize URL - remove fragment and keep it simple to avoid query string issues
      const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`

      return { isValid: true, normalizedUrl }
    } catch (error) {
      return { isValid: false, error: 'URL validation failed' }
    }
  }

  /**
   * Check if hostname is a private IP address
   */
  private isPrivateIP(hostname: string): boolean {
    // Check for IPv4 private ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = hostname.match(ipv4Regex)
    
    if (match) {
      const [, a, b, c, d] = match.map(Number)
      
      // Private IPv4 ranges
      if (a === 10) return true // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
      if (a === 192 && b === 168) return true // 192.168.0.0/16
      if (a === 127) return true // 127.0.0.0/8 (localhost)
      if (a === 169 && b === 254) return true // 169.254.0.0/16 (link-local)
    }

    // Check for IPv6 private ranges (simplified)
    if (hostname.includes(':')) {
      if (hostname.startsWith('::1') || hostname.startsWith('fc') || hostname.startsWith('fd')) {
        return true
      }
    }

    return false
  }

  /**
   * Fetch with manual redirect handling to validate each redirect URL
   */
  private async fetchWithRedirectValidation(url: string, options: RequestInit, maxRedirects: number = 5): Promise<Response> {
    let currentUrl = url
    let redirectCount = 0

    while (redirectCount <= maxRedirects) {
      // Validate current URL before making request
      const validation = this.validateUrl(currentUrl)
      if (!validation.isValid) {
        throw new Error(`Redirect URL validation failed: ${validation.error}`)
      }

      const response = await fetch(currentUrl, {
        ...options,
        redirect: 'manual' // Handle redirects manually
      })

      // If not a redirect, return the response
      if (response.status < 300 || response.status >= 400) {
        return response
      }

      // Handle redirect
      const location = response.headers.get('location')
      if (!location) {
        throw new Error('Redirect response missing Location header')
      }

      // Convert relative URLs to absolute
      try {
        currentUrl = new URL(location, currentUrl).toString()
      } catch (error) {
        throw new Error(`Invalid redirect URL: ${location}`)
      }

      redirectCount++
      
      if (redirectCount > maxRedirects) {
        throw new Error(`Too many redirects (max: ${maxRedirects})`)
      }
    }

    throw new Error('Unexpected redirect handling error')
  }

  /**
   * Fetch content from URL with security checks and redirect validation
   */
  private async fetchContent(url: string, options: ScrapingOptions, signal?: AbortSignal): Promise<{ content: string; contentType: string }> {
    // Use external signal if provided, otherwise create our own
    const controller = signal ? new AbortController() : new AbortController()
    let timeoutId: NodeJS.Timeout
    
    if (signal) {
      // If external signal is provided, listen to it
      if (signal.aborted) {
        throw new Error('Operation aborted')
      }
      signal.addEventListener('abort', () => controller.abort())
    }
    
    // Set up internal timeout
    timeoutId = setTimeout(() => controller.abort(), options.timeout)

    try {
      // Use manual redirect handling to validate each redirect URL
      const response = await this.fetchWithRedirectValidation(url, {
        method: 'GET',
        headers: {
          'User-Agent': options.userAgent!,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal,
        credentials: 'omit'
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Check content type - only allow HTML and XHTML
      const contentType = response.headers.get('content-type') || 'text/html'
      
      // Strict content-type validation - only allow HTML content
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new Error(`Unsupported content type: ${contentType}. Only HTML content is allowed.`)
      }

      // Check content length
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength) > options.maxContentLength!) {
        throw new Error(`Content too large: ${contentLength} bytes (max: ${options.maxContentLength})`)
      }

      // Add timeout for reading response body
      const textTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Response body read timeout')), 15000)
      })
      
      const content = await Promise.race([
        response.text(),
        textTimeout
      ])

      // Double-check content length after download
      if (content.length > options.maxContentLength!) {
        throw new Error(`Content too large: ${content.length} characters (max: ${options.maxContentLength})`)
      }

      return { content, contentType }
    } catch (error: any) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${options.timeout}ms`)
      }
      
      throw error
    }
  }

  /**
   * Simplified HTML text extraction that avoids complex regex
   */
  private extractTextFromHtmlSimple(html: string, url: string): { content: string; title?: string } {
    try {
      // Early termination for extremely large HTML
      if (html.length > 2000000) { // 2MB limit for simple processing
        html = html.substring(0, 2000000)
      }
      
      // Extract title using simple regex
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : undefined
      
      // Simple approach: remove scripts, styles, and convert to text
      let cleanHtml = html
        // Remove scripts and styles completely (simple approach)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
        // Remove common navigation elements
        .replace(/<nav\b[^>]*>.*?<\/nav>/gi, '')
        .replace(/<header\b[^>]*>.*?<\/header>/gi, '')
        .replace(/<footer\b[^>]*>.*?<\/footer>/gi, '')
      
      // Simple text extraction - just remove all HTML tags
      let text = cleanHtml
        .replace(/<[^>]*>/g, ' ') // Remove all HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // Collapse whitespace
        .trim()
      
      // Simple content filtering - remove very short lines and obvious navigation
      const lines = text.split('\n').filter(line => {
        const trimmed = line.trim()
        return trimmed.length > 20 && !trimmed.toLowerCase().match(/^(home|about|contact|menu|login|search)$/i)
      })
      
      const finalContent = lines.join('\n').trim()
      
      return {
        content: finalContent || text.substring(0, 10000), // Fallback to first 10k chars
        title
      }
    } catch (error) {
      console.error(`Simple HTML extraction failed for ${url}:`, error)
      return {
        content: 'Failed to extract content from HTML',
        title: undefined
      }
    }
  }

  /**
   * Extract and clean text content from HTML, focusing on headings and main content
   */
  private extractTextFromHtml(html: string, url: string): { content: string; title?: string } {
    try {
      // Early termination for extremely large HTML to prevent hanging
      if (html.length > 5000000) { // 5MB limit
        html = html.substring(0, 5000000)
      }
      
      // Extract title using regex
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : undefined
      // Remove script, style, and navigation elements with more efficient regex
      // Use non-greedy matching with length limits to prevent catastrophic backtracking
      let cleanHtml = html
        .replace(/<script[^>]*>[\s\S]{0,50000}?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]{0,50000}?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]{0,10000}?<\/noscript>/gi, '')
        .replace(/<nav[^>]*>[\s\S]{0,50000}?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]{0,50000}?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]{0,50000}?<\/footer>/gi, '')
        // Remove aside elements
        .replace(/<aside[^>]*>[\s\S]{0,50000}?<\/aside>/gi, '')
        
        // More aggressive footer/header removal patterns
        // Remove any element with id containing "footer" or "header"
        .replace(/<(\w+)[^>]*\bid="[^"]*footer[^"]*"[^>]*>[\s\S]{0,100000}?<\/\1>/gi, '')
        .replace(/<(\w+)[^>]*\bid="[^"]*header[^"]*"[^>]*>[\s\S]{0,100000}?<\/\1>/gi, '')
        
        // Remove any element with class containing "footer" or "header"
        .replace(/<(\w+)[^>]*\bclass="[^"]*footer[^"]*"[^>]*>[\s\S]{0,100000}?<\/\1>/gi, '')
        .replace(/<(\w+)[^>]*\bclass="[^"]*header[^"]*"[^>]*>[\s\S]{0,100000}?<\/\1>/gi, '')
        
        // Remove elements with navigation-related classes
        .replace(/<(\w+)[^>]*\bclass="[^"]*(?:nav|menu|sidebar|breadcrumb|social|share|navbar|topbar)[^"]*"[^>]*>[\s\S]{0,50000}?<\/\1>/gi, '')
        
        // Remove elements with navigation-related ids
        .replace(/<(\w+)[^>]*\bid="[^"]*(?:nav|menu|sidebar|breadcrumb|social|share|navbar|topbar)[^"]*"[^>]*>[\s\S]{0,50000}?<\/\1>/gi, '')
        
        // Remove common wrapper elements that often contain navigation
        .replace(/<div[^>]*\bclass="[^"]*(?:wrapper|container)[^"]*"[^>]*>\s*<div[^>]*\bclass="[^"]*(?:nav|menu|footer|header)[^"]*"[^>]*>[\s\S]{0,100000}?<\/div>\s*<\/div>/gi, '')
        
        // Remove elements with role attributes for navigation/banner/contentinfo
        .replace(/<(\w+)[^>]*\brole="(?:navigation|banner|contentinfo)"[^>]*>[\s\S]{0,50000}?<\/\1>/gi, '')
        
        // Remove common footer/header patterns regardless of tag name
        .replace(/<(\w+)[^>]*(?:id|class)="[^"]*(?:site-footer|site-header|page-footer|page-header|main-footer|main-header)[^"]*"[^>]*>[\s\S]{0,100000}?<\/\1>/gi, '')
      
      // Helper function to clean text content
      const cleanText = (text: string): string => {
        return text
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x2d;/g, '-')
          .replace(/\s+/g, ' ')
          .trim()
      }
      
      // Helper function to filter out navigation-like content
      const isNavigationContent = (text: string): boolean => {
        const lowerText = text.toLowerCase()
        
        // Common navigation patterns (generic, not site-specific)
        const navPatterns = [
          /^(home|about|contact|login|register|sign in|sign up|logout|search)$/i,
          /^(menu|navigation|nav|breadcrumb)$/i,
          /^(previous|next|back|forward|more|view all)$/i,
          /^(categories|tags|archive|recent|popular)$/i,
          /^(facebook|twitter|instagram|linkedin|youtube|social)$/i,
          /^(privacy|terms|policy|legal|copyright)$/i,
          /^(subscribe|newsletter|follow|share|like)$/i,
          /^(documentation|training|videos|community|forum|blog|news)$/i,
          /^(help|support|faq|guide|tutorial)$/i
        ]
        
        // Check if text matches navigation patterns
        for (const pattern of navPatterns) {
          if (pattern.test(text)) {
            return true
          }
        }
        
        // Check for very short navigation-like text with action words
        if (text.length < 30 && (
          lowerText.includes('click') ||
          lowerText.includes('here') ||
          lowerText.includes('link') ||
          lowerText.includes('page') ||
          lowerText.includes('view') ||
          lowerText.includes('see') ||
          lowerText.includes('read more') ||
          lowerText.includes('learn more')
        )) {
          return true
        }
        
        // Check for lists of short items (likely navigation)
        const words = text.split(/\s+/)
        if (words.length <= 3 && text.length < 50) {
          return true
        }
        
        // Check for common navigation separators in short text
        if (text.length < 100 && /[|•\-›»>]/.test(text) && words.length <= 5) {
          return true
        }
        
        return false
      }
      
      // Extract headings with their content (improved regex to handle nested HTML)
      const headings: string[] = []
      const headingRegex = /<(h[1-6])[^>]*>([\s\S]{0,5000}?)<\/h[1-6]>/gi
      let headingMatch
      let headingCount = 0
      while ((headingMatch = headingRegex.exec(cleanHtml)) !== null && headingCount < 100) {
        const level = headingMatch[1].toUpperCase()
        const text = cleanText(headingMatch[2])
        if (text && text.length > 0 && !isNavigationContent(text)) {
          headings.push(`${level}: ${text}`)
        }
        headingCount++
      }
      
      // Extract ALL main content paragraphs (improved regex to handle nested HTML)
      const paragraphs: string[] = []
      const paragraphRegex = /<p[^>]*>([\s\S]{0,10000}?)<\/p>/gi
      let paragraphMatch
      let paragraphCount = 0
      while ((paragraphMatch = paragraphRegex.exec(cleanHtml)) !== null && paragraphCount < 500) {
        const text = cleanText(paragraphMatch[1])
        
        // Filter out navigation content and very short paragraphs
        if (text && text.length > 20 && !isNavigationContent(text)) {
          paragraphs.push(text)
        }
        paragraphCount++
      }
      
      // Extract ALL list items for structured content (improved regex to handle nested HTML)
      const listItems: string[] = []
      const listRegex = /<li[^>]*>([\s\S]{0,5000}?)<\/li>/gi
      let listMatch
      let listCount = 0
      while ((listMatch = listRegex.exec(cleanHtml)) !== null && listCount < 200) {
        const text = cleanText(listMatch[1])
        
        // Filter out navigation content and very short items
        if (text && text.length > 10 && !isNavigationContent(text)) {
          listItems.push(`• ${text}`)
        }
        listCount++
      }
      
      // Also try to extract content from div elements that might contain main content
      const contentDivs: string[] = []
      const contentDivRegex = /<div[^>]*class="[^"]*(?:content|entry|post|article|main)[^"]*"[^>]*>([\s\S]{0,20000}?)<\/div>/gi
      let contentDivMatch
      let contentDivCount = 0
      while ((contentDivMatch = contentDivRegex.exec(cleanHtml)) !== null && contentDivCount < 50) {
        const text = cleanText(contentDivMatch[1])
        if (text && text.length > 50 && !isNavigationContent(text)) {
          // Extract paragraphs from content divs
          const divParagraphs = text.split(/\.\s+/).filter(p => p.trim().length > 20 && !isNavigationContent(p.trim()))
          contentDivs.push(...divParagraphs.map(p => p.trim() + (p.endsWith('.') ? '' : '.')))
        }
        contentDivCount++
      }
      
      // Post-process to remove any remaining navigation content
      const filterNavigationLines = (content: string): string => {
        return content
          .split('\n')
          .filter(line => {
            const trimmedLine = line.trim()
            if (!trimmedLine) return true // Keep empty lines for formatting
            
            // Remove lines that are clearly navigation
            if (trimmedLine.startsWith('•') && isNavigationContent(trimmedLine.substring(1).trim())) {
              return false
            }
            
            // Generic navigation pattern detection (not site-specific)
            const lowerLine = trimmedLine.toLowerCase()
            
            // Skip lines that are just navigation links (multiple short words separated by bullets/pipes)
            if (/^[•\|\-\s]*([a-z\s]{1,20}[•\|\-\s]+){3,}[a-z\s]{1,20}[•\|\-\s]*$/i.test(trimmedLine)) {
              return false
            }
            
            // Skip lines with multiple navigation-like separators
            if ((trimmedLine.match(/[•\|\-]/g) || []).length >= 3 && trimmedLine.length < 200) {
              return false
            }
            
            // Skip lines that are mostly common navigation words
            const commonNavWords = ['home', 'about', 'contact', 'login', 'register', 'search', 'menu', 'news', 'blog', 'help', 'support', 'privacy', 'terms', 'policy']
            const words = lowerLine.split(/\s+/).filter(word => word.length > 2)
            if (words.length > 0) {
              const navWordCount = words.filter(word => commonNavWords.includes(word)).length
              if (navWordCount / words.length > 0.5 && words.length <= 10) {
                return false
              }
            }
            
            // Skip lines that look like breadcrumbs (word > word > word)
            if (/\w+\s*[>»]\s*\w+\s*[>»]\s*\w+/.test(trimmedLine)) {
              return false
            }
            
            // Skip repetitive footer/copyright content
            if (/©\s*\d{4}|copyright|all rights reserved/i.test(trimmedLine)) {
              return false
            }
            
            // Skip footer menu content patterns
            if (/^(product|solutions|resources|developers)\s*$/i.test(trimmedLine)) {
              return false
            }
            
            // Skip lines that contain typical footer menu items
            if (lowerLine.includes('features') && lowerLine.includes('security') && lowerLine.includes('pricing')) {
              return false
            }
            
            // Skip lines with multiple footer-like links
            const footerKeywords = ['features', 'security', 'pricing', 'demo', 'solutions', 'resources', 'developers', 'contact', 'github', 'docs']
            const footerMatches = footerKeywords.filter(keyword => lowerLine.includes(keyword)).length
            if (footerMatches >= 3 && trimmedLine.length < 300) {
              return false
            }
            
            // Skip lines with excessive arrow/navigation symbols
            if ((trimmedLine.match(/--&gt;|&gt;|»|›/g) || []).length >= 3) {
              return false
            }
            
            // Skip very short lines that are likely navigation (less than 15 chars)
            if (trimmedLine.length < 15 && /^[a-z\s\-&;]+$/i.test(trimmedLine)) {
              return false
            }
            
            // Skip lines that are mostly navigation menu items (many short words)
            const shortWords = words.filter(word => word.length <= 4)
            if (words.length > 5 && shortWords.length / words.length > 0.7) {
              return false
            }
            
            return true
          })
          .join('\n')
      }
      
      // Combine extracted content
      let extractedContent = ''
      
      if (headings.length > 0) {
        extractedContent += headings.join('\n') + '\n\n'
      }
      
      if (paragraphs.length > 0) {
        // Include ALL paragraphs, not just first 5
        extractedContent += paragraphs.join('\n\n') + '\n\n'
      }
      
      if (listItems.length > 0) {
        // Include ALL list items
        extractedContent += listItems.join('\n') + '\n\n'
      }
      
      if (contentDivs.length > 0 && paragraphs.length < 3) {
        // If we didn't get many paragraphs, include content from divs
        extractedContent += contentDivs.slice(0, 10).join('\n\n') + '\n'
      }
      
      // Apply final navigation filtering
      extractedContent = filterNavigationLines(extractedContent)
      
      // Remove common patterns that often appear in footers/headers
      extractedContent = extractedContent
        // Remove copyright patterns
        .replace(/©\s*\d{4}.*?(?:\.|$)/gi, '')
        .replace(/Copyright\s*©?\s*\d{4}.*?(?:\.|$)/gi, '')
        .replace(/All rights reserved.*?(?:\.|$)/gi, '')
        // Remove arrow patterns (often used in navigation)
        .replace(/--&gt;/g, '')
        .replace(/&gt;&gt;/g, '')
        .replace(/»/g, '')
        // Remove "Search" followed by special characters (common in search boxes)
        .replace(/Search[×✕✖]/gi, '')
        // Remove excessive whitespace
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (!extractedContent || extractedContent.trim().length < 10) {
        throw new Error('Insufficient content extracted')
      }
      
      return { content: extractedContent.trim(), title }
    } catch (error) {
      throw new Error(`Failed to extract text from HTML: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Calculate similarity between two text strings using optimized word overlap
   * CPU-optimized version with early exits and length limits
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Early exit for identical texts
    if (text1 === text2) return 1
    
    // Early exit for very different lengths (likely different content)
    const lengthRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length)
    if (lengthRatio < 0.3) return 0
    
    // Limit text size for comparison to prevent CPU overload
    const maxChars = 5000
    const t1 = text1.length > maxChars ? text1.substring(0, maxChars) : text1
    const t2 = text2.length > maxChars ? text2.substring(0, maxChars) : text2
    
    const words1 = new Set(t1.toLowerCase().split(/\s+/).filter(word => word.length > 3))
    const words2 = new Set(t2.toLowerCase().split(/\s+/).filter(word => word.length > 3))
    
    // Early exit for very different word counts
    const wordCountRatio = Math.min(words1.size, words2.size) / Math.max(words1.size, words2.size)
    if (wordCountRatio < 0.2) return 0
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * Remove duplicate URLs from pages (URL-only deduplication for CPU efficiency)
   */
  private deduplicateContent(pages: ScrapedContent[]): ScrapedContent[] {
    const seenUrls = new Set<string>()
    const uniquePages: ScrapedContent[] = []
    
    for (const page of pages) {
      if (seenUrls.has(page.url)) {
        continue
      }
      
      seenUrls.add(page.url)
      uniquePages.push(page)
    }
    
    return uniquePages
  }

  /**
   * Sanitize extracted content
   */
  private sanitizeContent(content: string): string {
    // Remove any remaining HTML tags
    const sanitized = sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {},
      textFilter: (text: string) => {
        // Remove excessive whitespace and normalize
        return text
          .replace(/[\r\n\t]+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
      }
    })

    return sanitized
  }

  /**
   * Wrapper function to add aggressive timeout to any async operation
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${operation} timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })
    
    try {
      const result = await Promise.race([promise, timeoutPromise])
      clearTimeout(timeoutHandle!)
      return result
    } catch (error) {
      clearTimeout(timeoutHandle!)
      throw error
    }
  }

  /**
   * Try to extract content using article-extractor first
   */
  private async tryArticleExtractor(url: string, signal?: AbortSignal): Promise<{ content: string; title?: string } | null> {
    try {
      // Create a custom fetch function that respects our abort signal and validates redirects
      const customFetch = async (url: string) => {
        const controller = new AbortController()
        
        if (signal) {
          if (signal.aborted) {
            throw new Error('Operation aborted')
          }
          signal.addEventListener('abort', () => controller.abort())
        }
        
        const response = await this.fetchWithRedirectValidation(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.defaultOptions.userAgent!,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          credentials: 'omit'
        })
        
        return response
      }
      
      // Use article-extractor (it will use its own fetch internally)
      const article = await extract(url)
      
      if (article && article.content) {
        // Convert HTML to text
        const textContent = this.htmlToText(article.content)
        
        if (textContent && textContent.length > 50) {
          return {
            content: textContent,
            title: article.title
          }
        }
      }
      
      return null
    } catch (error) {
      console.log(`Article-extractor failed for ${url}, falling back to custom extraction`)
      return null
    }
  }

  /**
   * Convert HTML to plain text (helper method)
   */
  private htmlToText(html: string): string {
    // Create a DOM from the HTML
    const dom = new JSDOM(html)
    const document = dom.window.document
    
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, noscript')
    scripts.forEach(el => el.remove())
    
    // Get text content and preserve some structure
    const walker = document.createTreeWalker(
      document.body,
      dom.window.NodeFilter.SHOW_TEXT | dom.window.NodeFilter.SHOW_ELEMENT,
      null
    )
    
    let text = ''
    let lastNodeName = ''
    
    while (walker.nextNode()) {
      const node = walker.currentNode
      
      if (node.nodeType === dom.window.Node.TEXT_NODE) {
        const content = node.textContent?.trim() || ''
        if (content) {
          // Add appropriate spacing based on parent element
          const parentName = node.parentElement?.tagName?.toLowerCase() || ''
          
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(parentName)) {
            text += '\n\n' + content + '\n\n'
          } else if (['p', 'div', 'section', 'article'].includes(parentName)) {
            if (text && !text.endsWith('\n')) {
              text += '\n'
            }
            text += content + ' '
          } else if (parentName === 'li') {
            text += '\n• ' + content
          } else {
            // Inline elements - just add space
            if (text && !text.endsWith(' ') && !text.endsWith('\n')) {
              text += ' '
            }
            text += content
          }
          
          lastNodeName = parentName
        }
      } else if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
        const element = node as Element
        const tagName = element.tagName.toLowerCase()
        
        // Add line breaks for br tags
        if (tagName === 'br') {
          text += '\n'
        }
      }
    }
    
    // Clean up the text
    return text
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Clean up whitespace
      .replace(/\n{4,}/g, '\n\n')     // Replace 4+ newlines with 2
      .replace(/[ \t]+/g, ' ')        // Replace multiple spaces/tabs with single space
      .replace(/\n +/g, '\n')         // Remove spaces at start of lines
      .replace(/ +\n/g, '\n')         // Remove spaces at end of lines
      .replace(/ +$/gm, '')           // Remove trailing spaces on each line
      .replace(/^\n+/, '')            // Remove leading newlines
      .replace(/\n+$/, '')            // Remove trailing newlines
      .trim()
  }

  /**
   * Main method to scrape content from URL
   */
  async scrapeUrl(url: string, options: Partial<ScrapingOptions> = {}, signal?: AbortSignal): Promise<ScrapedContent> {
    const mergedOptions = { ...this.defaultOptions, ...options }

    // Validate URL
    const validation = this.validateUrl(url)
    if (!validation.isValid) {
      throw new Error(`URL validation failed: ${validation.error}`)
    }

    const normalizedUrl = validation.normalizedUrl!

    try {
      // Check if operation was aborted
      if (signal?.aborted) {
        throw new Error('Operation aborted')
      }

      // First, try article-extractor for better content extraction
      const articleResult = await this.tryArticleExtractor(normalizedUrl, signal)
      
      if (articleResult && articleResult.content) {
        console.log(`Successfully extracted content using article-extractor for ${normalizedUrl}`)
        
        return {
          content: articleResult.content,
          title: articleResult.title,
          url: normalizedUrl,
          contentType: 'text/plain',
          scrapedAt: new Date()
        }
      }

      // If article-extractor failed, fall back to custom extraction
      console.log(`Falling back to custom extraction for ${normalizedUrl}`)
      
      // Fetch content with abort signal
      const { content: rawContent, contentType } = await this.fetchContent(normalizedUrl, mergedOptions, signal)

      // Check if operation was aborted after fetch
      if (signal?.aborted) {
        throw new Error('Operation aborted')
      }

      let extractedContent: string
      let title: string | undefined

      // Process HTML content (only HTML content is now allowed)
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        // Use simple HTML processing to avoid hanging on complex pages
        const extracted = await this.withTimeout(
          Promise.resolve(this.extractTextFromHtmlSimple(rawContent, normalizedUrl)),
          10000, // Reduced to 10 seconds for simple processing
          `Simple HTML processing for ${normalizedUrl}`
        )
        
        extractedContent = extracted.content
        title = extracted.title
      } else {
        // This shouldn't happen due to content-type validation, but handle gracefully
        throw new Error(`Unexpected content type: ${contentType}`)
      }

      // Sanitize content
      const sanitizedContent = this.sanitizeContent(extractedContent)

      if (!sanitizedContent || sanitizedContent.length < 10) {
        throw new Error('Insufficient content extracted from URL')
      }

      // Truncate content if it's too large (instead of failing)
      let finalContent = sanitizedContent
      let wasTruncated = false
      
      if (sanitizedContent.length > mergedOptions.maxContentLength!) {
        finalContent = sanitizedContent.substring(0, mergedOptions.maxContentLength!) + '\n\n[Content truncated due to size limit]'
        wasTruncated = true
        console.warn(`Content truncated for ${normalizedUrl}: ${sanitizedContent.length} chars -> ${finalContent.length} chars`)
      }

      return {
        content: finalContent,
        title,
        url: normalizedUrl,
        contentType,
        scrapedAt: new Date()
      }
    } catch (error: any) {
      console.error(`Failed to scrape URL ${normalizedUrl}:`, error.message)
      throw new Error(`Failed to scrape URL: ${error.message}`)
    }
  }

  /**
   * Test if a URL is accessible without fully scraping it
   */
  async testUrl(url: string): Promise<{ accessible: boolean; error?: string; contentType?: string }> {
    
    const validation = this.validateUrl(url)
    if (!validation.isValid) {
      return { accessible: false, error: validation.error }
    }

    const normalizedUrl = validation.normalizedUrl!

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout for test

      const response = await this.fetchWithRedirectValidation(normalizedUrl, {
        method: 'HEAD', // Only get headers
        headers: {
          'User-Agent': this.defaultOptions.userAgent!
        },
        signal: controller.signal,
        credentials: 'omit'
      })

      clearTimeout(timeoutId)

      const contentType = response.headers.get('content-type') || 'unknown'

      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`
        return { accessible: false, error: errorMsg }
      }

      // Validate content type for HTML only
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return { accessible: false, error: `Unsupported content type: ${contentType}. Only HTML content is allowed.` }
      }

      return { accessible: true, contentType }
    } catch (error: any) {
      console.error(`URL test error for ${normalizedUrl}:`, error)
      
      if (error.name === 'AbortError') {
        return { accessible: false, error: 'Request timeout' }
      }
      return { accessible: false, error: error.message || 'Unknown fetch error' }
    }
  }

  /**
   * Extract links from HTML content
   */
  private extractLinks(html: string, baseUrl: string): string[] {
    try {
      const links: string[] = []
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
      let match

      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1]
        if (href) {
          try {
            // Convert relative URLs to absolute
            const absoluteUrl = new URL(href, baseUrl)
            // Remove fragment (hash) to prevent treating same page with different anchors as separate pages
            absoluteUrl.hash = ''
            links.push(absoluteUrl.toString())
          } catch (error) {
            // Skip invalid URLs
            continue
          }
        }
      }

      return [...new Set(links)] // Remove duplicates
    } catch (error) {
      console.warn('Failed to extract links:', error)
      return []
    }
  }

  /**
   * Filter URLs based on crawl options
   */
  private filterUrls(urls: string[], baseUrl: string, options: CrawlOptions): string[] {
    const baseDomain = new URL(baseUrl).hostname
    const basePath = new URL(baseUrl).pathname
    
    return urls.filter(url => {
      try {
        const parsedUrl = new URL(url)
        // Remove fragment for consistent comparison
        parsedUrl.hash = ''
        const normalizedUrl = parsedUrl.toString()
        
        // Same domain check
        if (options.sameDomainOnly && parsedUrl.hostname !== baseDomain) {
          return false
        }

        // Path-based filtering: if base URL has a path, only include subpages of that path
        if (basePath && basePath !== '/' && basePath !== '') {
          const urlPath = parsedUrl.pathname
          // Ensure the URL path starts with the base path
          if (!urlPath.startsWith(basePath)) {
            return false
          }
          // Additional check: make sure it's actually a subpage, not just a path that starts with the same characters
          // e.g., /docs should match /docs/page but not /documentation
          if (urlPath !== basePath && !urlPath.startsWith(basePath + '/')) {
            return false
          }
        }

        // Exclude patterns
        if (options.excludePatterns?.some(pattern => normalizedUrl.includes(pattern))) {
          return false
        }

        // Include patterns (if specified, URL must match at least one)
        if (options.includePatterns?.length && 
            !options.includePatterns.some(pattern => normalizedUrl.includes(pattern))) {
          return false
        }

        // Basic validation
        return this.validateUrl(normalizedUrl).isValid
      } catch (error) {
        return false
      }
    })
  }

  /**
   * Check robots.txt for crawling permissions
   */
  private async checkRobotsTxt(baseUrl: string): Promise<boolean> {
    if (!this.defaultCrawlOptions.respectRobotsTxt) {
      return true
    }

    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString()
      const response = await fetch(robotsUrl, {
        method: 'GET',
        headers: { 'User-Agent': this.defaultOptions.userAgent! },
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        return true // If robots.txt doesn't exist, assume crawling is allowed
      }

      const robotsContent = await response.text()
      
      // Simple robots.txt parsing - look for Disallow rules for our user agent
      const lines = robotsContent.split('\n')
      let isOurUserAgent = false
      
      for (const line of lines) {
        const trimmed = line.trim().toLowerCase()
        
        if (trimmed.startsWith('user-agent:')) {
          const userAgent = trimmed.split(':')[1]?.trim()
          isOurUserAgent = userAgent === '*' || userAgent === 'agent-ai-server'
        }
        
        if (isOurUserAgent && trimmed.startsWith('disallow:')) {
          const disallowPath = trimmed.split(':')[1]?.trim()
          if (disallowPath === '/' || disallowPath === '') {
            return false // Crawling is disallowed
          }
        }
      }

      return true
    } catch (error) {
      console.warn('Failed to check robots.txt:', error)
      return true // If we can't check, assume it's allowed
    }
  }

  /**
   * Crawl a website starting from a base URL
   */
  async crawlWebsite(baseUrl: string, options: Partial<CrawlOptions> = {}): Promise<WebsiteContent> {
    const mergedOptions = { ...this.defaultCrawlOptions, ...options }
    
    // Validate base URL
    const validation = this.validateUrl(baseUrl)
    if (!validation.isValid) {
      throw new Error(`Base URL validation failed: ${validation.error}`)
    }

    const normalizedBaseUrl = validation.normalizedUrl!
    
    // Check robots.txt
    const robotsAllowed = await this.checkRobotsTxt(normalizedBaseUrl)
    if (!robotsAllowed) {
      throw new Error('Crawling is disallowed by robots.txt')
    }

    const visitedUrls = new Set<string>()
    const urlsToVisit: Array<{ url: string; depth: number }> = [{ url: normalizedBaseUrl, depth: 0 }]
    const scrapedPages: ScrapedContent[] = []
    let totalContentLength = 0

    const basePath = new URL(normalizedBaseUrl).pathname

    while (urlsToVisit.length > 0 && scrapedPages.length < mergedOptions.maxPages!) {
      const { url, depth } = urlsToVisit.shift()!
      
      if (visitedUrls.has(url) || depth > mergedOptions.maxDepth!) {
        continue
      }

      visitedUrls.add(url)
      
      try {
        console.log(`Crawling page ${scrapedPages.length + 1}/${mergedOptions.maxPages}: ${url} (depth: ${depth})`)
        const startTime = Date.now()
        
        // Scrape the current page with timeout
        try {
          const scrapedContent = await this.withTimeout(
            this.scrapeUrl(url),
            45000,
            `Page scrape for ${url}`
          )
          
          console.log(`  ✓ Page scraped in ${Date.now() - startTime}ms - ${scrapedContent.content.length} characters`)
          console.log(`  📄 Title: ${scrapedContent.title || 'No title'}`)
          
          // Print full content scraped from this page
          console.log(`\n${'='.repeat(80)}`)
          console.log(`FULL CONTENT SCRAPED FROM: ${url}`)
          console.log(`TITLE: ${scrapedContent.title || 'No title'}`)
          console.log(`LENGTH: ${scrapedContent.content.length} characters`)
          console.log(`${'='.repeat(80)}`)
          console.log(scrapedContent.content)
          console.log(`${'='.repeat(80)}\n`)
          
          scrapedPages.push(scrapedContent)
          totalContentLength += scrapedContent.content.length
        } catch (error: any) {
          if (error.message.includes('timeout')) {
            console.warn(`⚠️  Page timeout: ${error.message}`)
            throw new Error(`Page crawl timeout after 45 seconds for ${url}`)
          }
          throw error
        }

        // Extract links for next level if we haven't reached max depth
        if (depth < mergedOptions.maxDepth!) {
          try {
            const linkStartTime = Date.now()
            
            try {
              const { content } = await this.withTimeout(
                this.fetchContent(url, this.defaultOptions),
                30000,
                `Link extraction for ${url}`
              )
              console.log(`  ✓ Links extracted in ${Date.now() - linkStartTime}ms`)
              
              const links = this.extractLinks(content, url)
              const filteredLinks = this.filterUrls(links, normalizedBaseUrl, mergedOptions)
              console.log(`  → Found ${filteredLinks.length} new links to crawl (${links.length} total found)`)
              
              // Add new URLs to visit
              let newLinksAdded = 0
              for (const link of filteredLinks) {
                if (!visitedUrls.has(link) && !urlsToVisit.some(item => item.url === link)) {
                  urlsToVisit.push({ url: link, depth: depth + 1 })
                  newLinksAdded++
                }
              }
              console.log(`  ➕ Added ${newLinksAdded} new URLs to crawl queue`)
            } catch (linkError: any) {
              if (linkError.message.includes('timeout')) {
                console.warn(`⚠️  Link extraction timeout: ${linkError.message}`)
              } else {
                console.warn(`⚠️  Failed to extract links from ${url}:`, linkError.message)
              }
            }
          } catch (linkError) {
            console.warn(`⚠️  Failed to extract links from ${url}:`, linkError)
            // Continue without links if extraction fails
          }
        }

        // Add delay between requests to be respectful and reduce CPU load
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error: any) {
        console.warn(`❌ Failed to scrape ${url}: ${error.message}`)
        // Continue with other pages even if one fails
      }
      
      // Progress summary
      console.log(`📊 Progress: ${scrapedPages.length}/${mergedOptions.maxPages} pages scraped, ${urlsToVisit.length} URLs remaining in queue`)
    }

    if (scrapedPages.length === 0) {
      throw new Error('No pages could be scraped from the website')
    }

    console.log(`\nStarting URL deduplication for ${scrapedPages.length} pages...`)
    
    // Remove duplicate/similar content between pages
    const uniquePages = this.deduplicateContent(scrapedPages)
    const finalContentLength = uniquePages.reduce((sum, page) => sum + page.content.length, 0)
    
    console.log(`URL deduplication complete: ${scrapedPages.length} pages → ${uniquePages.length} unique pages (${scrapedPages.length - uniquePages.length} duplicate URLs removed)`)

    // Generate summary
    const summary = this.generateWebsiteSummary(uniquePages, normalizedBaseUrl)

    console.log(`Website crawl completed: ${uniquePages.length} unique pages (${scrapedPages.length} total), ${finalContentLength} total characters`)

    return {
      baseUrl: normalizedBaseUrl,
      pages: uniquePages,
      totalPages: uniquePages.length,
      totalContentLength: finalContentLength,
      scrapedAt: new Date(),
      summary
    }
  }

  /**
   * Crawl a website with progress callbacks for real-time updates
   */
  async crawlWebsiteWithProgress(
    baseUrl: string, 
    options: Partial<CrawlOptions> = {},
    onProgress?: (progress: {
      message: string;
      currentPage: number;
      estimatedTotal: number;
      currentUrl: string;
    }) => void | Promise<void>
  ): Promise<WebsiteContent> {
    const mergedOptions = { ...this.defaultCrawlOptions, ...options }
    
    // Validate base URL
    const validation = this.validateUrl(baseUrl)
    if (!validation.isValid) {
      throw new Error(`Base URL validation failed: ${validation.error}`)
    }

    const normalizedBaseUrl = validation.normalizedUrl!
    
    // Check robots.txt
    const robotsAllowed = await this.checkRobotsTxt(normalizedBaseUrl)
    if (!robotsAllowed) {
      throw new Error('Crawling is disallowed by robots.txt')
    }

    const visitedUrls = new Set<string>()
    const urlsToVisit: Array<{ url: string; depth: number }> = [{ url: normalizedBaseUrl, depth: 0 }]
    const scrapedPages: ScrapedContent[] = []
    let totalContentLength = 0

    const basePath = new URL(normalizedBaseUrl).pathname

    while (urlsToVisit.length > 0 && scrapedPages.length < mergedOptions.maxPages!) {
      const { url, depth } = urlsToVisit.shift()!
      
      if (visitedUrls.has(url) || depth > mergedOptions.maxDepth!) {
        continue
      }

      visitedUrls.add(url)
      
      try {
        console.log(`Crawling page ${scrapedPages.length + 1}/${mergedOptions.maxPages}: ${url} (depth: ${depth})`)
        const startTime = Date.now()
        
        // Send progress update
        if (onProgress) {
          await onProgress({
            message: `Crawling page ${scrapedPages.length + 1}`,
            currentPage: scrapedPages.length + 1,
            estimatedTotal: Math.min(urlsToVisit.length + scrapedPages.length + 1, mergedOptions.maxPages!),
            currentUrl: url
          })
        }
        
        // Scrape the current page with timeout
        try {
          const scrapedContent = await this.withTimeout(
            this.scrapeUrl(url),
            45000,
            `Page scrape for ${url}`
          )
          console.log(`  ✓ Page scraped in ${Date.now() - startTime}ms`)
          
          // Print full content scraped from this page
          console.log(`\n${'='.repeat(80)}`)
          console.log(`FULL CONTENT SCRAPED FROM: ${url}`)
          console.log(`TITLE: ${scrapedContent.title || 'No title'}`)
          console.log(`LENGTH: ${scrapedContent.content.length} characters`)
          console.log(`${'='.repeat(80)}`)
          console.log(scrapedContent.content)
          console.log(`${'='.repeat(80)}\n`)
          
          scrapedPages.push(scrapedContent)
          totalContentLength += scrapedContent.content.length
        } catch (error: any) {
          if (error.message.includes('timeout')) {
            console.warn(`⚠️  Page timeout: ${error.message}`)
            throw new Error(`Page crawl timeout after 45 seconds for ${url}`)
          }
          throw error
        }

        // Extract links for next level if we haven't reached max depth
        if (depth < mergedOptions.maxDepth!) {
          try {
            const linkStartTime = Date.now()
            
            try {
              const { content } = await this.withTimeout(
                this.fetchContent(url, this.defaultOptions),
                30000,
                `Link extraction for ${url}`
              )
              console.log(`  ✓ Links extracted in ${Date.now() - linkStartTime}ms`)
              
              const links = this.extractLinks(content, url)
              const filteredLinks = this.filterUrls(links, normalizedBaseUrl, mergedOptions)
              console.log(`  → Found ${filteredLinks.length} new links to crawl`)
              
              // Add new URLs to visit
              for (const link of filteredLinks) {
                if (!visitedUrls.has(link) && !urlsToVisit.some(item => item.url === link)) {
                  urlsToVisit.push({ url: link, depth: depth + 1 })
                }
              }
            } catch (linkError: any) {
              if (linkError.message.includes('timeout')) {
                console.warn(`⚠️  Link extraction timeout: ${linkError.message}`)
              } else {
                console.warn(`Failed to extract links from ${url}:`, linkError)
              }
            }
          } catch (linkError) {
            console.warn(`Failed to extract links from ${url}:`, linkError)
            // Continue without links if extraction fails
          }
        }

        // Add delay between requests to be respectful and reduce CPU load
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.warn(`Failed to scrape ${url}:`, error)
        // Continue with other pages even if one fails
      }
    }

    if (scrapedPages.length === 0) {
      throw new Error('No pages could be scraped from the website')
    }

    // Remove duplicate/similar content between pages
    const uniquePages = this.deduplicateContent(scrapedPages)
    const finalContentLength = uniquePages.reduce((sum, page) => sum + page.content.length, 0)

    // Generate summary
    const summary = this.generateWebsiteSummary(uniquePages, normalizedBaseUrl)

    console.log(`Website crawl completed: ${uniquePages.length} unique pages (${scrapedPages.length} total), ${finalContentLength} total characters`)

    return {
      baseUrl: normalizedBaseUrl,
      pages: uniquePages,
      totalPages: uniquePages.length,
      totalContentLength: finalContentLength,
      scrapedAt: new Date(),
      summary
    }
  }

  /**
   * Generate a summary of the crawled website
   */
  private generateWebsiteSummary(pages: ScrapedContent[], baseUrl: string): string {
    const parsedBaseUrl = new URL(baseUrl)
    const domain = parsedBaseUrl.hostname
    const basePath = parsedBaseUrl.pathname
    const titles = pages.map(page => page.title).filter(Boolean)
    const totalWords = pages.reduce((sum, page) => sum + page.content.split(/\s+/).length, 0)
    
    let summary = `Website: ${domain}`
    if (basePath && basePath !== '/' && basePath !== '') {
      summary += ` (${basePath} section)`
    }
    summary += `\n`
    summary += `Pages crawled: ${pages.length}\n`
    summary += `Total content: ${totalWords.toLocaleString()} words\n`
    
    if (titles.length > 0) {
      summary += `\nPage titles:\n`
      titles.slice(0, 10).forEach((title, index) => {
        summary += `${index + 1}. ${title}\n`
      })
      if (titles.length > 10) {
        summary += `... and ${titles.length - 10} more pages\n`
      }
    }
    
    return summary
  }

  /**
   * Test if a website can be crawled
   */
  async testWebsite(baseUrl: string, options: Partial<CrawlOptions> = {}): Promise<{
    accessible: boolean
    error?: string
    estimatedPages?: number
    robotsAllowed?: boolean
    sampleLinks?: string[]
  }> {
    try {
      // First test the base URL
      const urlTest = await this.testUrl(baseUrl)
      if (!urlTest.accessible) {
        return { accessible: false, error: urlTest.error }
      }

      // Check robots.txt
      const robotsAllowed = await this.checkRobotsTxt(baseUrl)
      if (!robotsAllowed) {
        return { 
          accessible: false, 
          error: 'Crawling is disallowed by robots.txt',
          robotsAllowed: false
        }
      }

      // Try to get a sample of links to estimate crawlable pages
      try {
        const { content } = await this.fetchContent(baseUrl, this.defaultOptions)
        const links = this.extractLinks(content, baseUrl)
        const mergedOptions = { ...this.defaultCrawlOptions, ...options }
        const filteredLinks = this.filterUrls(links, baseUrl, mergedOptions)
        
        return {
          accessible: true,
          robotsAllowed: true,
          estimatedPages: Math.min(filteredLinks.length + 1, mergedOptions.maxPages!),
          sampleLinks: filteredLinks.slice(0, 5)
        }
      } catch (error) {
        // If we can't analyze links, but the base URL is accessible, still return success
        return {
          accessible: true,
          robotsAllowed: true,
          estimatedPages: 1
        }
      }
    } catch (error: any) {
      return { accessible: false, error: error.message }
    }
  }
}

export const webScrapingService = new WebScrapingService()
export default webScrapingService 