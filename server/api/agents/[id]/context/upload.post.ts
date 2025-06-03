import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { fileProcessingService } from '~/server/services/fileProcessingService'
import { ragService } from '~/server/services/ragService'
import formidable, { File, Fields, Files } from 'formidable'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import os from 'os'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Verify authentication
    const user = await requireAuth(event)

    // Get agent ID from params
    const agentId = getRouterParam(event, 'id')
    if (!agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent ID is required'
      })
    }

    // Find the agent
    const agent = await Agent.findById(agentId)
    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Defensive check: Ensure createdBy field exists (fix for legacy agents)
    if (!agent.createdBy) {
      console.warn(`Agent ${agent.name} missing createdBy field, setting to current user`)
      agent.createdBy = user._id
    }

    // Check if user has access to this agent
    if (user.role !== 'admin' && !user.agentAccess?.includes(new mongoose.Types.ObjectId(agentId))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied to this agent'
      })
    }

    // Parse the multipart form data
    const form = formidable({
      uploadDir: os.tmpdir(),
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 1,
      filter: (part) => {
        // Only allow file uploads (not other form fields)
        return part.name === 'file' && !!part.originalFilename
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

    console.log(`Processing uploaded file: ${originalFilename} (${size} bytes, ${mimetype})`)

    // Check if file with same name already exists
    const existingDoc = agent.contextDocuments.find(doc => 
      doc.type === 'file' && doc.filename === originalFilename
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
        originalFilename,
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

    // Create context document
    const contextDocument = {
      type: 'file' as const,
      content: processedFile.content,
      filename: processedFile.filename,
      uploadedAt: new Date(),
      metadata: {
        originalName: processedFile.originalName,
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
            title: processedFile.filename,
            source: processedFile.originalName
          }
        )
        ragInfo = {
          chunksCreated: ragResult.chunksCreated,
          collectionName: ragResult.collectionName
        }
        console.log(`✅ RAG processing completed: ${ragResult.chunksCreated} chunks created`)
      }
    } catch (ragError) {
      console.error('RAG processing failed (non-critical):', ragError)
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
            originalName: processedFile.originalName,
            size: processedFile.size,
            mimeType: processedFile.mimeType
          }
        },
        agent: {
          _id: agent._id,
          name: agent.name,
          contextDocumentsCount: agent.contextDocuments.length
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