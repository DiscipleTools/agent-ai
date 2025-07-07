/**
 * File Processing Service
 * 
 * Handles secure upload, validation, and text extraction from various file types including
 * PDF, Word documents (.doc/.docx), and plain text files. Provides comprehensive file
 * validation, content extraction, and cleanup operations while maintaining data integrity.
 */

import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import { sanitizeFilename, sanitizeContent, sanitizeText } from '~/utils/sanitize.js'

interface ProcessedFile {
  content: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  extractedAt: Date
}

interface FileValidationResult {
  isValid: boolean
  error?: string
  fileExtension?: string
  mimeType?: string
}

class FileProcessingService {
  private readonly allowedExtensions = ['.pdf', '.txt', '.doc', '.docx']
  private readonly allowedMimeTypes = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
  private readonly maxFileSize = 10 * 1024 * 1024 // 10MB

  /**
   * Validate file type and size
   */
  validateFile(filename: string, size: number, mimeType?: string): FileValidationResult {
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = sanitizeFilename(filename)
    if (!sanitizedFilename) {
      return {
        isValid: false,
        error: 'Invalid filename'
      }
    }

    // Check file size
    if (size > this.maxFileSize) {
      return {
        isValid: false,
        error: `File size too large. Maximum allowed size is ${this.maxFileSize / (1024 * 1024)}MB`
      }
    }

    // Get file extension from sanitized filename
    const fileExtension = path.extname(sanitizedFilename).toLowerCase()
    
    // Check file extension
    if (!this.allowedExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: `File type not supported. Allowed types: ${this.allowedExtensions.join(', ')}`
      }
    }

    // Check MIME type if provided
    if (mimeType && !this.allowedMimeTypes.includes(mimeType)) {
      return {
        isValid: false,
        error: `MIME type not supported: ${mimeType}`
      }
    }

    return {
      isValid: true,
      fileExtension,
      mimeType
    }
  }

  /**
   * Extract text content from uploaded file
   */
  async processFile(filePath: string, originalName: string, size: number, mimeType?: string): Promise<ProcessedFile> {
    // Sanitize inputs
    const sanitizedOriginalName = sanitizeFilename(originalName)
    if (!sanitizedOriginalName) {
      throw new Error('Invalid filename provided')
    }

    // Validate file path to prevent path traversal
    const resolvedPath = path.resolve(filePath)
    if (!resolvedPath.includes('/tmp/') && !resolvedPath.includes('\\temp\\')) {
      throw new Error('Invalid file path')
    }

    // Validate file
    const validation = this.validateFile(sanitizedOriginalName, size, mimeType)
    if (!validation.isValid) {
      throw new Error(validation.error!)
    }

    const fileExtension = validation.fileExtension!
    let extractedContent: string

    try {
      // Verify file exists and is readable
      await fs.promises.access(resolvedPath, fs.constants.R_OK)
      
      // Read file buffer
      const fileBuffer = await fs.promises.readFile(resolvedPath)

      // Extract text based on file type
      switch (fileExtension) {
        case '.pdf':
          extractedContent = await this.extractPdfText(fileBuffer)
          break
        case '.doc':
        case '.docx':
          extractedContent = await this.extractWordText(fileBuffer)
          break
        case '.txt':
          extractedContent = await this.extractPlainText(fileBuffer)
          break
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`)
      }

      // Validate extracted content
      if (!extractedContent || extractedContent.trim().length === 0) {
        throw new Error('No text content could be extracted from the file')
      }

      // Clean up the content and sanitize for security
      const cleanedContent = this.cleanExtractedText(extractedContent)
      const sanitizedContent = this.sanitizeExtractedContent(cleanedContent)

      if (sanitizedContent.length < 10) {
        throw new Error('Extracted content is too short (minimum 10 characters)')
      }

      return {
        content: sanitizedContent,
        filename: this.generateCleanFilename(sanitizedOriginalName),
        originalName: sanitizedOriginalName,
        size,
        mimeType: mimeType || this.getMimeTypeFromExtension(fileExtension),
        extractedAt: new Date()
      }

    } catch (error: any) {
      console.error(`File processing error for ${sanitizedOriginalName}:`, error.message)
      throw new Error(`Failed to process file: ${error.message}`)
    } finally {
      // Clean up temporary file
      try {
        await fs.promises.unlink(resolvedPath)
      } catch (error) {
        console.warn(`Failed to clean up temporary file: ${resolvedPath}`)
      }
    }
  }

  /**
   * Extract text from PDF file using dynamic import
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      // Use dynamic import to avoid initialization issues
      const pdfParse = await import('pdf-parse')
      const data = await pdfParse.default(buffer)
      return data.text
    } catch (error: any) {
      throw new Error(`PDF extraction failed: ${error.message}`)
    }
  }

  /**
   * Extract text from Word document
   */
  private async extractWordText(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch (error: any) {
      throw new Error(`Word document extraction failed: ${error.message}`)
    }
  }

  /**
   * Extract text from plain text file
   */
  private async extractPlainText(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString('utf-8')
    } catch (error: any) {
      throw new Error(`Text file extraction failed: ${error.message}`)
    }
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanExtractedText(text: string): string {
    return text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      // Trim whitespace
      .trim()
  }

  /**
   * Sanitize extracted content for security
   */
  private sanitizeExtractedContent(text: string): string {
    // Use the sanitizeContent function to remove potentially dangerous content
    return sanitizeContent(text)
  }

  /**
   * Generate a clean filename for storage
   */
  private generateCleanFilename(originalName: string): string {
    // Use the sanitizeFilename function for consistent sanitization
    const sanitized = sanitizeFilename(originalName)
    if (!sanitized) {
      return 'unknown_file.txt'
    }
    
    const extension = path.extname(sanitized)
    const baseName = path.basename(sanitized, extension)
    
    // Additional cleaning and length limitation
    const cleanName = baseName.substring(0, 50) // Limit length
    
    return `${cleanName}${extension}`
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    return mimeTypes[extension] || 'application/octet-stream'
  }

  /**
   * Get supported file types for frontend validation
   */
  getSupportedFileTypes(): { extensions: string[], mimeTypes: string[], maxSize: number } {
    return {
      extensions: this.allowedExtensions,
      mimeTypes: this.allowedMimeTypes,
      maxSize: this.maxFileSize
    }
  }
}

export const fileProcessingService = new FileProcessingService()
export default fileProcessingService 