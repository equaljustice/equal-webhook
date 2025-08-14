import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';
import { logger } from './logging.js';

// Function to delete a file from local storage
export function deleteFile(filePath) {
    logger.debug(`Attempting to delete file: ${filePath}`);
    
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                logger.error(`Error deleting file ${filePath}:`, err);
                reject(err);
            } else {
                logger.info(`File deleted successfully: ${filePath}`);
                resolve();
            }
        });
    });
}

function getFileType(url) {
    if (url.endsWith('.pdf')) {
        return 'pdf';
    } else if (url.endsWith('.docx')) {
        return 'docx';
    } else {
        return null;
    }
}

// Function to extract text from a PDF file
async function extractTextFromPDF(data) {
    logger.debug(`Starting PDF text extraction - Data size: ${data.length} bytes`);
    
    try {
        const parsedData = await pdfParse(data);
        logger.info(`PDF text extraction completed - Pages: ${parsedData.numpages}, Text length: ${parsedData.text.length}`);
        return parsedData.text;
    } catch (error) {
        logger.error('Error extracting text from PDF:', error);
        throw error;
    }
}

// Function to extract text from a DOCX file
async function extractTextFromDOCX(data) {
    logger.debug(`Starting DOCX text extraction - Data size: ${data.length} bytes`);
    
    try {
        const result = await mammoth.extractRawText({ buffer: data });
        logger.info(`DOCX text extraction completed - Text length: ${result.value.length}`);
        return result.value;
    } catch (error) {
        logger.error('Error extracting text from DOCX:', error);
        throw error;
    }
}

// Main function to handle both PDF and DOCX files
export async function extractTextFromDocument(filePath, mime_type) {
    const startTime = Date.now();
    logger.info(`Starting document text extraction - File: ${filePath}, MIME type: ${mime_type}`);
    
    if (!filePath) {
        logger.warn("Null FilePath provided for text extraction");
        return;
    }
    
    try {
        // ⚡ FILE SIZE VALIDATION: Prevent memory issues
        logger.debug(`Checking file size for: ${filePath}`);
        const stats = await fs.promises.stat(filePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        logger.info(`File size check completed - Size: ${fileSizeInMB.toFixed(2)}MB`);
        
        if (fileSizeInMB > 50) { // ⚡ SIZE LIMIT: 50MB max
            const errorMsg = `File too large: ${fileSizeInMB.toFixed(2)}MB. Maximum size is 50MB.`;
            logger.error(errorMsg, { filePath, fileSize: fileSizeInMB });
            throw new Error(errorMsg);
        }
        
        // ⚡ STREAMING FOR LARGE FILES: Memory efficient processing
        if (fileSizeInMB > 10) {
            logger.info(`Large file detected (${fileSizeInMB.toFixed(2)}MB), using streaming extraction`);
            const result = await extractTextWithStreaming(filePath, mime_type);
            const totalTime = Date.now() - startTime;
            logger.info(`Streaming extraction completed - Time: ${totalTime}ms, File: ${filePath}`);
            return result;
        }
        
        // ⚡ ASYNC FILE READING: Non-blocking operation
        logger.debug(`Reading file content - File: ${filePath}, Size: ${fileSizeInMB.toFixed(2)}MB`);
        const dataBuffer = await fs.promises.readFile(filePath);
        logger.debug(`File content read successfully - Buffer size: ${dataBuffer.length} bytes`);
        
        const fileType = mime_type || getFileType(filePath);
        logger.debug(`File type determined - Type: ${fileType}, MIME: ${mime_type}`);

        if (!fileType) {
            const errorMsg = 'Unsupported file type';
            logger.error(errorMsg, { filePath, mime_type, fileType });
            throw new Error(errorMsg);
        }

        let extractedText;
        
        if (fileType.endsWith('pdf')) {
            logger.debug(`Processing PDF file - File: ${filePath}`);
            extractedText = await extractTextFromPDF(dataBuffer);
        } else if (fileType.endsWith('document') || fileType.endsWith('docx')) {
            logger.debug(`Processing DOCX file - File: ${filePath}`);
            extractedText = await extractTextFromDOCX(dataBuffer);
        }
        
        // ⚡ BETTER LOGGING: File processing metrics
        const totalTime = Date.now() - startTime;
        logger.info(`Document text extraction completed successfully`, {
            filePath: filePath,
            fileSize: `${fileSizeInMB.toFixed(2)}MB`,
            fileType: fileType,
            extractedTextLength: extractedText?.length || 0,
            processingTime: `${totalTime}ms`
        });
        
        return extractedText;

    } catch (error) {
        const totalTime = Date.now() - startTime;
        // ⚡ ENHANCED ERROR HANDLING: Specific error messages
        logger.error(`Document text extraction failed`, {
            filePath: filePath,
            mime_type: mime_type,
            error: error.message,
            processingTime: `${totalTime}ms`,
            stack: error.stack
        });
        return null;
    }
}

// ⚡ NEW FUNCTION: Streaming text extraction for large files
async function extractTextWithStreaming(filePath, mime_type) {
    logger.info(`Starting streaming text extraction - File: ${filePath}, MIME: ${mime_type}`);
    
    try {
        const fileType = mime_type || getFileType(filePath);
        logger.debug(`Streaming extraction file type - Type: ${fileType}`);
        
        if (fileType.endsWith('pdf')) {
            // Use streaming PDF parser for large files
            logger.debug(`Using streaming PDF parser for: ${filePath}`);
            return await extractTextFromPDFStream(filePath);
        } else if (fileType.endsWith('document') || fileType.endsWith('docx')) {
            // Use streaming DOCX parser for large files
            logger.debug(`Using streaming DOCX parser for: ${filePath}`);
            return await extractTextFromDOCXStream(filePath);
        }
        
        const errorMsg = 'Unsupported file type for streaming';
        logger.error(errorMsg, { filePath, mime_type, fileType });
        throw new Error(errorMsg);
        
    } catch (error) {
        logger.error(`Streaming text extraction failed`, {
            filePath: filePath,
            mime_type: mime_type,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Placeholder functions for streaming extraction (implement based on your needs)
async function extractTextFromPDFStream(filePath) {
    logger.debug(`PDF streaming extraction placeholder - File: ${filePath}`);
    // Implement streaming PDF extraction here
    throw new Error('PDF streaming extraction not yet implemented');
}

async function extractTextFromDOCXStream(filePath) {
    logger.debug(`DOCX streaming extraction placeholder - File: ${filePath}`);
    // Implement streaming DOCX extraction here
    throw new Error('DOCX streaming extraction not yet implemented');
}
