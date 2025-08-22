import { logger } from '../utils/logging.js';

export async function checkFileAvailability(fileURL) {
    const startTime = Date.now();
    const requestId = `check_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    logger.debug('Starting file availability check', {
        fileURL: fileURL,
        requestId: requestId,
        timestamp: new Date().toISOString()
    });

    try {
        // ⚡ VALIDATION: Ensure URL is provided and valid
        if (!fileURL || typeof fileURL !== 'string') {
            logger.error('Invalid file URL provided for availability check', {
                fileURL: fileURL,
                urlType: typeof fileURL,
                requestId: requestId
            });
            return false;
        }
        
        // ⚡ URL VALIDATION: Basic URL format check
        try {
            const urlObj = new URL(fileURL);
            logger.debug('URL validation passed', {
                fileURL: fileURL,
                protocol: urlObj.protocol,
                hostname: urlObj.hostname,
                pathname: urlObj.pathname,
                requestId: requestId
            });
        } catch (urlError) {
            logger.error('Invalid URL format for availability check', {
                fileURL: fileURL,
                urlError: urlError.message,
                requestId: requestId
            });
            return false;
        }
        
        logger.info('Checking file availability via HTTP HEAD request', {
            fileURL: fileURL,
            method: 'HEAD',
            timeout: 10000,
            requestId: requestId
        });
        
        // Make a fetch request to the file URL with timeout
        const response = await fetch(fileURL, {
            method: 'HEAD', // Use HEAD for faster response (no body download)
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'EqualJustice-FileChecker/1.0'
            }
        });

        const checkTime = Date.now() - startTime;

        if (response.ok) {
            const contentLength = response.headers.get('content-length');
            const contentType = response.headers.get('content-type');
            const lastModified = response.headers.get('last-modified');
            const cacheControl = response.headers.get('cache-control');
            
            logger.info('File availability check - File is available', {
                fileURL: fileURL,
                status: response.status,
                statusText: response.statusText,
                contentLength: contentLength || 'unknown',
                contentType: contentType,
                lastModified: lastModified,
                cacheControl: cacheControl,
                checkTimeMs: checkTime,
                requestId: requestId,
                timestamp: new Date().toISOString()
            });
            return true;
        } else {
            // File is not available yet
            logger.debug('File availability check - File not yet available', {
                fileURL: fileURL,
                status: response.status,
                statusText: response.statusText,
                checkTimeMs: checkTime,
                requestId: requestId,
                willRetry: true
            });
            return false;
        }
    } catch (error) {
        const checkTime = Date.now() - startTime;
        
        // ⚡ ENHANCED ERROR LOGGING: Categorize and log specific error types
        const errorContext = {
            fileURL: fileURL,
            error: error.message,
            errorType: error.constructor.name,
            errorCode: error.code,
            errorName: error.name,
            checkTimeMs: checkTime,
            requestId: requestId,
            timestamp: new Date().toISOString()
        };
        
        if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
            errorContext.category = 'timeout';
            errorContext.suggestion = 'File might be large or network is slow';
            logger.warn('File availability check timed out', errorContext);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorContext.category = 'network';
            errorContext.suggestion = 'Check network connectivity and DNS resolution';
            logger.warn('Network error during file availability check', errorContext);
        } else if (error.message.includes('fetch') || error.message.includes('Request')) {
            errorContext.category = 'http_request';
            errorContext.suggestion = 'HTTP request failed, possibly due to CORS or server issues';
            logger.warn('HTTP request error during file availability check', errorContext);
        } else {
            errorContext.category = 'unknown';
            errorContext.suggestion = 'Unknown error occurred during file check';
            logger.error('Unknown error during file availability check', errorContext);
        }
        
        return false;
    }
}