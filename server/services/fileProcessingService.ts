import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'

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
    // Check file size
    if (size > this.maxFileSize) {
      return {
        isValid: false,
        error: `File size too large. Maximum allowed size is ${this.maxFileSize / (1024 * 1024)}MB`
      }
    }

    // Get file extension
    const fileExtension = path.extname(filename).toLowerCase()
    
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
    // Validate file
    const validation = this.validateFile(originalName, size, mimeType)
    if (!validation.isValid) {
      throw new Error(validation.error!)
    }

    const fileExtension = validation.fileExtension!
    let extractedContent: string

    try {
      // Read file buffer
      const fileBuffer = await fs.promises.readFile(filePath)

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

      // Clean up the content
      const cleanedContent = this.cleanExtractedText(extractedContent)

      if (cleanedContent.length < 10) {
        throw new Error('Extracted content is too short (minimum 10 characters)')
      }

      return {
        content: cleanedContent,
        filename: this.generateCleanFilename(originalName),
        originalName,
        size,
        mimeType: mimeType || this.getMimeTypeFromExtension(fileExtension),
        extractedAt: new Date()
      }

    } catch (error: any) {
      console.error(`File processing error for ${originalName}:`, error.message)
      throw new Error(`Failed to process file: ${error.message}`)
    } finally {
      // Clean up temporary file
      try {
        await fs.promises.unlink(filePath)
      } catch (error) {
        console.warn(`Failed to clean up temporary file: ${filePath}`)
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
   * Generate a clean filename for storage
   */
  private generateCleanFilename(originalName: string): string {
    const extension = path.extname(originalName)
    const baseName = path.basename(originalName, extension)
    
    // Clean the filename
    const cleanName = baseName
      .replace(/[^a-zA-Z0-9\-_\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50) // Limit length
    
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