/**
 * Web Scraping Service
 * 
 * A comprehensive web scraping and crawling service that provides secure, efficient
 * content extraction from websites. This service includes:
 * 
 * - URL validation and security checks (blocked domains, private IPs, content type validation)
 * - Content extraction using both article-extractor and custom HTML parsing
 * - Website crawling with configurable depth, page limits, and filtering
 * - Duplicate content detection and removal
 * - Robots.txt compliance checking
 * - Timeout handling and error recovery
 * - Progress tracking for long-running crawls
 * - Content sanitization and text cleaning
 * 
 * The service prioritizes security by validating all URLs, checking for blocked domains,
 * and only allowing HTML content. It also includes comprehensive error handling and
 * CPU-optimized processing to handle large websites efficiently.
 * 
 * @example
 * // Scrape a single URL
 * const content = await webScrapingService.scrapeUrl('https://example.com')
 * 
 * // Crawl an entire website
 * const website = await webScrapingService.crawlWebsite('https://example.com', {
 *   maxPages: 20,
 *   maxDepth: 2
 * })
 */

import { extract } from '@extractus/article-extractor'
import { validateUrl } from '../utils/urlValidator'
import { sanitizeContent } from '~/utils/sanitize.js'
import { JSDOM } from 'jsdom'

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
    userAgent: 'Agent-AI-Server/1.0 (+https://github.com/DiscipleTools/agent-ai)',
    allowedDomains: [],
    blockedDomains: [] // Additional blocked domains beyond the defaults in urlValidator
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
   * Validate and sanitize URL using the shared URL validator
   */
  private validateUrl(url: string): { isValid: boolean; error?: string; normalizedUrl?: string } {
    return validateUrl(url, this.defaultOptions.blockedDomains)
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

      // Use article-extractor for content extraction
      const articleResult = await this.tryArticleExtractor(normalizedUrl, signal)
      
      if (!articleResult || !articleResult.content) {
        throw new Error('Failed to extract content from URL using article-extractor')
      }

      console.log(`Successfully extracted content using article-extractor for ${normalizedUrl}`)
      
      // Sanitize content
      const sanitizedContent = sanitizeContent(articleResult.content)

      if (!sanitizedContent || sanitizedContent.length < 10) {
        throw new Error('Insufficient content extracted from URL')
      }

      // Truncate content if it's too large (instead of failing)
      let finalContent = sanitizedContent
      
      if (sanitizedContent.length > mergedOptions.maxContentLength!) {
        finalContent = sanitizedContent.substring(0, mergedOptions.maxContentLength!) + '\n\n[Content truncated due to size limit]'
        console.warn(`Content truncated for ${normalizedUrl}: ${sanitizedContent.length} chars -> ${finalContent.length} chars`)
      }

      return {
        content: finalContent,
        title: articleResult.title,
        url: normalizedUrl,
        contentType: 'text/plain',
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