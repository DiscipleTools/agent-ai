/**
 * Agent Context Document File Upload API Endpoint
 * 
 * Handles file uploads for agent context documents. This endpoint:
 * - Accepts multipart file uploads (max 10MB, single file)
 * - Validates user authentication and agent access permissions
 * - Processes uploaded files to extract text content
 * - Stores the document in the agent's contextDocuments array
 * - Processes the document for RAG (Retrieval Augmented Generation) vector embeddings
 * - Returns success response with document metadata and RAG processing info
 * 
 * Security features:
 * - File size and count limits
 * - File type validation through formidable filter
 * - User authentication and authorization checks
 * - Duplicate filename detection
 * - Temporary file cleanup on errors
 */
import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { fileProcessingService } from '~/server/services/fileProcessingService'
import { ragService } from '~/server/services/ragService'
import formidable, { File, Fields, Files } from 'formidable'
import fs from 'fs'
import path from 'path'
import os from 'os'

export default chatwootAuthMiddleware.agentAccess('write')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Find the agent (permission already verified by middleware)
    const agent = await Agent.findById(agentId)
    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Define allowed file types for security
    const allowedMimeTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/csv',
      'text/markdown',
      'text/x-markdown'
    ]
    
    const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx', '.csv', '.md']

    // Parse the multipart form data
    const form = formidable({
      uploadDir: os.tmpdir(),
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 1,
      filter: (part) => {
        // Enhanced file validation
        if (part.name !== 'file' || !part.originalFilename) {
          return false
        }
        
        // Validate file extension
        const ext = path.extname(part.originalFilename).toLowerCase()
        if (!allowedExtensions.includes(ext)) {
          console.warn(`Rejected file with disallowed extension: ${ext}`)
          return false
        }
        
        // Validate MIME type if provided
        if (part.mimetype && !allowedMimeTypes.includes(part.mimetype)) {
          console.warn(`Rejected file with disallowed MIME type: ${part.mimetype}`)
          return false
        }
        
        return true
      }
    })

    let fields: Fields
    let files: Files

    try {
      [fields, files] = await form.parse(event.node.req)
    } catch (error: any) {
      console.error('File upload parsing error:', error)
      throw createError({
        statusCode: 400,
        statusMessage: `File upload failed: ${error.message}`
      })
    }

    // Check if file was uploaded
    const fileArray = files.file as File[] | undefined
    if (!fileArray || !fileArray[0]) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No file uploaded'
      })
    }

    const uploadedFile = fileArray[0]
    const { filepath, originalFilename, size, mimetype } = uploadedFile

    if (!originalFilename) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Original filename is required'
      })
    }

    // Sanitize filename to prevent path traversal attacks
    const sanitizedFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9.-]/g, '_')
    
    // Additional security validations
    const fileExtension = path.extname(originalFilename).toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      // Clean up uploaded file
      try {
        await fs.promises.unlink(filepath)
      } catch (error) {
        console.warn('Failed to clean up uploaded file:', error)
      }
      
      throw createError({
        statusCode: 400,
        statusMessage: `File type ${fileExtension} is not allowed. Allowed types: ${allowedExtensions.join(', ')}`
      })
    }
    
    // Validate MIME type matches allowed types
    if (mimetype && !allowedMimeTypes.includes(mimetype)) {
      // Clean up uploaded file
      try {
        await fs.promises.unlink(filepath)
      } catch (error) {
        console.warn('Failed to clean up uploaded file:', error)
      }
      
      throw createError({
        statusCode: 400,
        statusMessage: `MIME type ${mimetype} is not allowed`
      })
    }

    console.log(`Processing uploaded file: ${sanitizedFilename} (${size} bytes, ${mimetype})`)

    // Check if file with same name already exists (using sanitized filename)
    const existingDoc = agent.contextDocuments.find((doc: any) => 
      doc.type === 'file' && doc.filename === sanitizedFilename
    )

    if (existingDoc) {
      // Clean up uploaded file
      try {
        await fs.promises.unlink(filepath)
      } catch (error) {
        console.warn('Failed to clean up uploaded file:', error)
      }
      
      throw createError({
        statusCode: 409,
        statusMessage: 'A file with this name already exists in context documents'
      })
    }

    // Process the file and extract text content
    let processedFile
    try {
      processedFile = await fileProcessingService.processFile(
        filepath,
        sanitizedFilename, // Use sanitized filename
        size || 0,
        mimetype || undefined
      )
    } catch (error: any) {
      console.error('File processing failed:', error.message)
      
      // Clean up uploaded file if processing failed
      try {
        await fs.promises.unlink(filepath)
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file after processing error:', cleanupError)
      }
      
      throw createError({
        statusCode: 400,
        statusMessage: error.message
      })
    }

    // Validate extracted content length (max 1MB of text)
    const maxContentLength = 1024 * 1024 // 1MB
    if (processedFile.content.length > maxContentLength) {
      // Clean up uploaded file
      try {
        await fs.promises.unlink(filepath)
      } catch (error) {
        console.warn('Failed to clean up uploaded file:', error)
      }
      
      throw createError({
        statusCode: 400,
        statusMessage: `Extracted content too large (${processedFile.content.length} characters). Maximum allowed: ${maxContentLength} characters.`
      })
    }

    // Create context document
    const contextDocument = {
      type: 'file' as const,
      content: processedFile.content,
      filename: sanitizedFilename, // Use sanitized filename for storage
      uploadedAt: new Date(),
      metadata: {
        originalName: originalFilename, // Keep original filename in metadata
        sanitizedName: sanitizedFilename,
        size: processedFile.size,
        mimeType: processedFile.mimeType,
        extractedAt: processedFile.extractedAt
      }
    }

    // Add to agent's context documents
    agent.contextDocuments.push(contextDocument)
    await agent.save()

    // Get the document ID for RAG processing
    const savedDocument = agent.contextDocuments[agent.contextDocuments.length - 1]
    const documentId = savedDocument._id?.toString()

    console.log(`Added file context to agent ${agent.name}: ${processedFile.filename} (${processedFile.content.length} characters)`)

    // Process document for RAG (vector embeddings)
    let ragInfo = null
    try {
      if (documentId) {
        const ragResult = await ragService.processDocument(
          agentId,
          documentId,
          processedFile.content,
          {
            type: 'file',
            title: sanitizedFilename,
            source: originalFilename
          }
        )
        ragInfo = {
          chunksCreated: ragResult.chunksCreated,
          collectionName: ragResult.collectionName
        }
        
        // Update document metadata with RAG status
        const docIndex = agent.contextDocuments.length - 1
        agent.contextDocuments[docIndex].metadata = {
          ...agent.contextDocuments[docIndex].metadata,
          rag: {
            processed: true,
            chunksCreated: ragResult.chunksCreated,
            processedAt: new Date()
          }
        }
        await agent.save()
        
        console.log(`✅ RAG processing completed: ${ragResult.chunksCreated} chunks created`)
      }
    } catch (ragError: any) {
      console.error('RAG processing failed (non-critical):', ragError)
      
      // Update document metadata to indicate RAG processing failed
      const docIndex = agent.contextDocuments.length - 1
      agent.contextDocuments[docIndex].metadata = {
        ...agent.contextDocuments[docIndex].metadata,
        rag: {
          processed: false,
          error: ragError.message || 'RAG processing failed',
          attemptedAt: new Date()
        }
      }
      await agent.save()
      
      // RAG failure is non-critical - document is still saved to MongoDB
    }

    return {
      success: true,
      message: 'File uploaded and processed successfully',
      data: {
        contextDocument: {
          type: contextDocument.type,
          filename: contextDocument.filename,
          uploadedAt: contextDocument.uploadedAt,
          contentLength: contextDocument.content.length,
          metadata: {
            originalName: originalFilename,
            sanitizedName: sanitizedFilename,
            size: processedFile.size,
            mimeType: processedFile.mimeType
          }
        },
        rag: ragInfo
      }
    }

  } catch (error: any) {
    console.error('File upload error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to upload file'
    })
  }
}) 