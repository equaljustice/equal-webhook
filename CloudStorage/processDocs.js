import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import * as constants from '../constants.js';
import { logger } from '../utils/logging.js';

const storage = new Storage();

export function processDocx(information, folder, fileName) {
    const startTime = Date.now();
    logger.info(`Starting document creation process`, {
        folder: folder,
        fileName: fileName,
        informationLength: typeof information === 'string' ? information.length : 'non-string',
        informationType: typeof information,
        timestamp: new Date().toISOString()
    });

    try {
        var temp_doc = "./CloudStorage/Bank.docx";
        const templatePath = path.resolve(temp_doc);
        
        // ⚡ TEMPLATE VALIDATION: Check if template exists
        if (!fs.existsSync(templatePath)) {
            const error = new Error(`Template file not found: ${templatePath}`);
            logger.error('Template file missing', {
                templatePath: templatePath,
                fileName: fileName,
                folder: folder,
                error: error.message
            });
            throw error;
        }
        
        logger.debug('Template file found, reading content', {
            templatePath: templatePath,
            fileName: fileName
        });
        
        // Load the docx file as binary content
        const content = fs.readFileSync(templatePath, "binary");
        const templateSize = content.length;
        
        logger.debug('Template content loaded', {
            templateSize: templateSize,
            fileName: fileName,
            folder: folder
        });

        // Unzip the content of the file
        const zip = new PizZip(content);
        logger.debug('Template ZIP content parsed', { fileName: fileName });

        // This will parse the template, and will throw an error if the template is
        // invalid, for example, if the template is "{user" (no closing tag)
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });
        
        logger.debug('Docxtemplater initialized', {
            fileName: fileName,
            paragraphLoop: true,
            linebreaks: true
        });
        
        temp_doc = "Bank.docx"
        // Call the render function with the form values
        if (temp_doc == "Bank.docx") {
            logger.debug('Rendering document with data', {
                fileName: fileName,
                informationPreview: typeof information === 'string' ? information.substring(0, 200) + '...' : 'non-string data',
                informationLength: typeof information === 'string' ? information.length : 'unknown'
            });
            
            doc.render({
                info: information
            });
            
            logger.info('Document rendered successfully', {
                fileName: fileName,
                folder: folder
            });
        }

        logger.debug('Generating ZIP buffer', { fileName: fileName });
        const buf = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });
        
        const bufferSize = buf.length;
        logger.info('Document buffer generated', {
            fileName: fileName,
            bufferSize: bufferSize,
            bufferSizeMB: (bufferSize / (1024 * 1024)).toFixed(2)
        });

        // ⚡ FILE CREATION: Write file with proper error handling
        const outputPath = `${fileName}.docx`;
        logger.debug('Writing document to file system', {
            outputPath: outputPath,
            bufferSize: bufferSize,
            fileName: fileName
        });
        
        fs.writeFileSync(outputPath, buf);
        
        // ⚡ FILE VERIFICATION: Confirm file was created
        if (fs.existsSync(outputPath)) {
            const fileStats = fs.statSync(outputPath);
            logger.info('Document file created successfully', {
                outputPath: outputPath,
                fileSize: fileStats.size,
                fileSizeMB: (fileStats.size / (1024 * 1024)).toFixed(2),
                fileName: fileName,
                folder: folder,
                creationTime: fileStats.birthtime
            });
        } else {
            const error = new Error('File was not created despite no errors');
            logger.error('File creation verification failed', {
                outputPath: outputPath,
                fileName: fileName,
                error: error.message
            });
            throw error;
        }
        
        const processingTime = Date.now() - startTime;
        logger.info('Starting cloud upload process', {
            fileName: fileName,
            folder: folder,
            outputPath: outputPath,
            processingTimeMs: processingTime
        });
        
        return uploadToCloudBucketNew(folder, `${fileName}.docx`);
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error('Document creation process failed', {
            fileName: fileName,
            folder: folder,
            error: error.message,
            stack: error.stack,
            processingTimeMs: processingTime,
            errorType: error.constructor.name,
            timestamp: new Date().toISOString()
        });
        
        // ⚡ CLEANUP: Remove partial file if it exists
        const outputPath = `${fileName}.docx`;
        if (fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath);
                logger.debug('Cleaned up partial file after error', { outputPath: outputPath });
            } catch (cleanupError) {
                logger.warn('Failed to cleanup partial file', {
                    outputPath: outputPath,
                    cleanupError: cleanupError.message
                });
            }
        }
        
        throw error;
    }
}

function uploadToCloudBucket(folder, destinationFile) {

    // Initialize storage
    

    const bucketName = constants.PUBLIC_BUCKET_DEV;
    const bucket = storage.bucket(bucketName)

    // Sending the upload request
    bucket.upload(
        path.resolve(destinationFile), {
            destination: `${folder}/${destinationFile}`,
        },
        function(err, file) {
            if (err) {
                console.error(`Error uploading ${destinationFile}: ${err}`)
            } else {
                file.makePublic(async function(err) {
                    if (err) {
                        console.error(`Error making file public: ${err}`)
                        return err.message;
                    } else {
                        const publicUrl = file.publicUrl()
                        console.log(`Public URL for ${file.name}: ${publicUrl}`)
                        return publicUrl;
                    }
                })

            }
        }
    )
}

async function uploadToCloudBucketNew(folder, destinationFile) {
    const startTime = Date.now();
    const bucketName = constants.PUBLIC_BUCKET_DEV;
    const filePath = path.resolve(destinationFile);
    
    logger.info('Starting cloud storage upload', {
        folder: folder,
        destinationFile: destinationFile,
        filePath: filePath,
        bucketName: bucketName,
        timestamp: new Date().toISOString()
    });

    try {
        // ⚡ PRE-UPLOAD VALIDATION: Check if file exists and get stats
        if (!fs.existsSync(filePath)) {
            const error = new Error(`Source file not found: ${filePath}`);
            logger.error('Upload failed - source file missing', {
                filePath: filePath,
                destinationFile: destinationFile,
                folder: folder,
                error: error.message
            });
            throw error;
        }
        
        const fileStats = fs.statSync(filePath);
        logger.info('Pre-upload file validation passed', {
            filePath: filePath,
            fileSize: fileStats.size,
            fileSizeMB: (fileStats.size / (1024 * 1024)).toFixed(2),
            lastModified: fileStats.mtime,
            folder: folder,
            destinationFile: destinationFile
        });

        // ⚡ STORAGE INITIALIZATION: Validate storage and bucket
        const bucket = storage.bucket(bucketName);
        const destination = `${folder}/${path.basename(destinationFile)}`;
        
        logger.debug('Storage bucket initialized', {
            bucketName: bucketName,
            destination: destination,
            resumable: true
        });

        // Upload the file
        logger.debug('Starting file upload to cloud storage', {
            source: filePath,
            destination: destination,
            bucketName: bucketName
        });
        
        const [file] = await bucket.upload(filePath, {
            destination: destination,
            resumable: true,  // Ensure resumable uploads for large files
            metadata: {
                cacheControl: 'public, max-age=31536000', // Cache for 1 year
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }
        });

        const uploadTime = Date.now() - startTime;
        logger.info('File uploaded successfully to cloud storage', {
            destinationFile: destinationFile,
            folder: folder,
            fileName: file.name,
            bucket: bucketName,
            uploadTimeMs: uploadTime,
            destination: destination
        });

        // ⚡ MAKE FILE PUBLIC: Set proper permissions
        logger.debug('Making file public', {
            fileName: file.name,
            bucket: bucketName
        });
        
        await file.makePublic();
        
        const publicUrl = file.publicUrl();
        const totalTime = Date.now() - startTime;
        
        logger.info('Cloud upload process completed successfully', {
            destinationFile: destinationFile,
            folder: folder,
            publicUrl: publicUrl,
            fileName: file.name,
            bucket: bucketName,
            totalTimeMs: totalTime,
            uploadTimeMs: uploadTime,
            fileSizeMB: (fileStats.size / (1024 * 1024)).toFixed(2),
            timestamp: new Date().toISOString()
        });
        
        // ⚡ CLEANUP: Remove local file after successful upload
        try {
            fs.unlinkSync(filePath);
            logger.debug('Local file cleaned up after successful upload', {
                filePath: filePath,
                publicUrl: publicUrl
            });
        } catch (cleanupError) {
            logger.warn('Failed to cleanup local file after upload', {
                filePath: filePath,
                cleanupError: cleanupError.message,
                publicUrl: publicUrl
            });
            // Don't fail the upload for cleanup issues
        }
        
        return publicUrl;

    } catch (err) {
        const totalTime = Date.now() - startTime;
        
        // ⚡ ENHANCED ERROR LOGGING: Detailed error context
        const errorContext = {
            destinationFile: destinationFile,
            folder: folder,
            filePath: filePath,
            bucketName: bucketName,
            error: err.message,
            errorCode: err.code,
            errorType: err.constructor.name,
            totalTimeMs: totalTime,
            timestamp: new Date().toISOString()
        };
        
        // Add specific error details based on error type
        if (err.code === 'ENOENT') {
            errorContext.issue = 'File not found';
            errorContext.suggestion = 'Check if file was created properly before upload';
        } else if (err.code === 'EACCES') {
            errorContext.issue = 'Permission denied';
            errorContext.suggestion = 'Check file permissions and Google Cloud credentials';
        } else if (err.message.includes('Not Found')) {
            errorContext.issue = 'Google Cloud bucket not found';
            errorContext.suggestion = 'Verify bucket name and Google Cloud configuration';
        } else if (err.message.includes('Forbidden')) {
            errorContext.issue = 'Insufficient permissions';
            errorContext.suggestion = 'Check Google Cloud IAM permissions for bucket access';
        } else if (err.message.includes('network') || err.message.includes('timeout')) {
            errorContext.issue = 'Network connectivity problem';
            errorContext.suggestion = 'Check internet connection and Google Cloud API availability';
        }
        
        logger.error('Cloud storage upload failed', errorContext);
        
        // ⚡ CLEANUP: Remove local file even on upload failure
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                logger.debug('Local file cleaned up after upload failure', {
                    filePath: filePath
                });
            } catch (cleanupError) {
                logger.warn('Failed to cleanup local file after upload failure', {
                    filePath: filePath,
                    cleanupError: cleanupError.message
                });
            }
        }
        
        throw err;  // Re-throw the error with enhanced logging
    }
}