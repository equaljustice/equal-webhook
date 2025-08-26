import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logging.js';
import { trimString } from './DFchipsToButtons.js';
import { checkFileAvailability } from '../CloudStorage/checkFileReadyness.js';

// ⚡ RATE LIMITING: Prevent WhatsApp API bans
class RateLimiter {
    constructor(tokensPerInterval = 1000, interval = 'second') {
        this.tokensPerInterval = tokensPerInterval;
        this.interval = interval;
        this.tokens = tokensPerInterval;
        this.lastRefill = Date.now();
        this.refillTime = interval === 'second' ? 1000 : 60000;
        
        logger.info(`RateLimiter initialized - ${tokensPerInterval} tokens per ${interval}`);
    }
    
    async removeTokens(count = 1) {
        this.refillTokens();
        
        if (this.tokens >= count) {
            this.tokens -= count;
            logger.debug(`RateLimiter: ${count} tokens consumed, ${this.tokens} remaining`);
            return;
        }
        
        const waitTime = this.refillTime;
        logger.warn(`RateLimiter: Insufficient tokens. Waiting ${waitTime}ms for refill`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.removeTokens(count);
    }
    
    refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const refillCount = Math.floor(timePassed / this.refillTime);
        
        if (refillCount > 0) {
            this.tokens = Math.min(this.tokensPerInterval, this.tokens + refillCount);
            this.lastRefill = now;
            logger.debug(`RateLimiter: Refilled ${refillCount} tokens, Total: ${this.tokens}`);
        }
    }
}

const rateLimiter = new RateLimiter(1000, 'second');

// ⚡ MONITORING: Track API health metrics
const apiMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastSuccessfulCall: null,
    lastFailureCall: null,
    recentErrors: [] // Keep last 10 errors
};

function recordApiCall(success, error = null) {
    apiMetrics.totalRequests++;
    
    if (success) {
        apiMetrics.successfulRequests++;
        apiMetrics.lastSuccessfulCall = new Date().toISOString();
    } else {
        apiMetrics.failedRequests++;
        apiMetrics.lastFailureCall = new Date().toISOString();
        
        // Keep recent errors (max 10)
        if (error) {
            apiMetrics.recentErrors.push({
                timestamp: new Date().toISOString(),
                message: error.message,
                status: error.response?.status,
                code: error.code
            });
            
            if (apiMetrics.recentErrors.length > 10) {
                apiMetrics.recentErrors.shift(); // Remove oldest
            }
        }
    }
}

export function getWhatsAppAPIMetrics() {
    const successRate = apiMetrics.totalRequests > 0 
        ? (apiMetrics.successfulRequests / apiMetrics.totalRequests * 100).toFixed(2)
        : '0.00';
    
    return {
        ...apiMetrics,
        successRate: `${successRate}%`,
        currentTime: new Date().toISOString()
    };
}

// ⚡ HEALTH CHECK: Validate WhatsApp API configuration
export function validateWhatsAppConfig() {
    const errors = [];
    
    if (!process.env.WhatsApp_Token) {
        errors.push('WhatsApp_Token environment variable is missing');
    } else if (process.env.WhatsApp_Token.length < 50) {
        errors.push('WhatsApp_Token appears to be invalid (too short)');
    }
    
    if (errors.length > 0) {
        logger.error('WhatsApp API Configuration Issues:', { errors });
        return { valid: false, errors };
    }
    
    logger.info('WhatsApp API configuration validated successfully');
    return { valid: true, errors: [] };
}

// ⚡ INPUT VALIDATION: Validate API call parameters
function validateAPICallParams(data, phone_number_id) {
    const errors = [];
    
    if (!phone_number_id) {
        errors.push('phone_number_id is required');
    } else if (!/^\d+$/.test(phone_number_id)) {
        errors.push('phone_number_id must contain only digits');
    }
    
    if (!data) {
        errors.push('data payload is required');
        return errors;
    }
    
        try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        
        // ⚡ BASIC STRUCTURE VALIDATION
            if (!parsedData.messaging_product || parsedData.messaging_product !== 'whatsapp') {
                errors.push('Invalid messaging_product in data payload');
            }
        
            if (!parsedData.to) {
                errors.push('Missing recipient (to) in data payload');
        } else {
            // ⚡ PHONE NUMBER VALIDATION: WhatsApp format
            const phoneNumber = parsedData.to.toString();
            if (!/^\d{10,15}$/.test(phoneNumber)) {
                errors.push(`Invalid phone number format: ${phoneNumber} (must be 10-15 digits)`);
            }
        }
        
        if (!parsedData.type) {
            errors.push('Missing message type in data payload');
        }
        
        // ⚡ TYPE-SPECIFIC VALIDATION
        switch (parsedData.type) {
            case 'text':
                if (!parsedData.text || !parsedData.text.body) {
                    errors.push('Missing text.body for text message');
                } else if (parsedData.text.body.length > 4096) {
                    errors.push(`Text message too long: ${parsedData.text.body.length} chars (max 4096)`);
                }
                break;
                
            case 'interactive':
                if (!parsedData.interactive) {
                    errors.push('Missing interactive object for interactive message');
                } else {
                    const interactive = parsedData.interactive;
                    
                    if (!interactive.type) {
                        errors.push('Missing interactive.type');
                    }
                    
                    // Validate interactive message limits
                    if (interactive.body && interactive.body.text && interactive.body.text.length > 1024) {
                        errors.push(`Interactive body text too long: ${interactive.body.text.length} chars (max 1024)`);
                    }
                    
                    if (interactive.header && interactive.header.text && interactive.header.text.length > 60) {
                        errors.push(`Interactive header text too long: ${interactive.header.text.length} chars (max 60)`);
                    }
                    
                    if (interactive.footer && interactive.footer.text && interactive.footer.text.length > 60) {
                        errors.push(`Interactive footer text too long: ${interactive.footer.text.length} chars (max 60)`);
                    }
                    
                    // Validate CTA URL format
                    if (interactive.type === 'cta_url') {
                        if (!interactive.action || !interactive.action.parameters || !interactive.action.parameters.url) {
                            errors.push('Missing URL parameters for cta_url interactive message');
                        } else {
                            // Validate URL format and protocol
                            try {
                                const urlObj = new URL(interactive.action.parameters.url);
                                if (urlObj.protocol !== 'https:') {
                                    errors.push(`CTA URL must use HTTPS protocol, got: ${urlObj.protocol}`);
                                }
                            } catch (urlError) {
                                errors.push(`Invalid URL format in cta_url: ${interactive.action.parameters.url}`);
                            }
                            
                            // Validate action structure
                            if (!interactive.action.name || interactive.action.name !== 'cta_url') {
                                errors.push('CTA URL action must have name "cta_url"');
                            }
                            
                            // Validate display text
                            if (!interactive.action.parameters.display_text) {
                                errors.push('Missing display_text for cta_url action');
                            } else if (interactive.action.parameters.display_text.length > 20) {
                                errors.push(`CTA URL display_text too long: ${interactive.action.parameters.display_text.length} chars (max 20)`);
                            }
                        }
                    }
                }
                break;
                
            case 'document':
                if (!parsedData.document) {
                    errors.push('Missing document object for document message');
                }
                break;
        }
        
        // ⚡ PAYLOAD SIZE VALIDATION
        const payloadSize = JSON.stringify(parsedData).length;
        if (payloadSize > 1048576) { // 1MB limit
            errors.push(`Payload too large: ${payloadSize} bytes (max 1MB)`);
        }
        
    } catch (parseError) {
        errors.push(`Invalid JSON in data payload: ${parseError.message}`);
    }
    
    return errors;
}

async function callWhatsAppAPI(data, phone_number_id) {
    const requestId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`WhatsApp API call started - RequestID: ${requestId}, PhoneID: ${phone_number_id}`);
    
    try {
        // ⚡ INPUT VALIDATION: Check parameters before making API call
        const validationErrors = validateAPICallParams(data, phone_number_id);
        if (validationErrors.length > 0) {
            // ⚡ CONSOLE DEBUG: Show validation failures immediately
            console.error('=== PRE-VALIDATION FAILED ===');
            console.error('Request ID:', requestId);
            console.error('Validation Errors:', validationErrors);
            console.error('Phone Number ID:', phone_number_id);
            console.error('Data Type:', typeof data);
            console.error('Raw Data:', data);
            console.error('============================');
            
            // ⚡ LOG PAYLOAD FOR DEBUGGING: Include sanitized payload in validation errors
            const sanitizedPayload = typeof data === 'string' ? JSON.parse(data) : data;
            if (sanitizedPayload.to) {
                sanitizedPayload.to = sanitizedPayload.to.toString().substring(0, 5) + '***';
            }
            
            logger.error(`WhatsApp API Validation Error - RequestID: ${requestId}`, {
                errors: validationErrors,
                phoneNumberId: phone_number_id,
                requestId,
                sanitizedPayload: sanitizedPayload,
                payloadSize: JSON.stringify(data).length
            });
            
            const validationError = new Error(`Validation failed: ${validationErrors.join(', ')}`);
            validationError.isValidationError = true;
            validationError.validationErrors = validationErrors;
            throw validationError;
        } else {
            console.log(`✅ Pre-validation passed - RequestID: ${requestId}, DataType: ${typeof data}, Size: ${JSON.stringify(data).length}`);
        }
        
        // ⚡ CONFIG VALIDATION: Ensure WhatsApp token is available
        const configValidation = validateWhatsAppConfig();
        if (!configValidation.valid) {
            logger.error(`WhatsApp API Config Error - RequestID: ${requestId}`, {
                errors: configValidation.errors,
                requestId
            });
            throw new Error(`Configuration error: ${configValidation.errors.join(', ')}`);
        }
        
        // ⚡ RATE LIMIT PROTECTION: Wait for available token
        logger.debug(`RateLimiter: Waiting for token - RequestID: ${requestId}`);
        await rateLimiter.removeTokens(1);
        logger.debug(`RateLimiter: Token acquired - RequestID: ${requestId}`);
        
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            timeout: 30000,  // ⚡ TIMEOUT: Increased to 30 seconds for WhatsApp API
            url: `https://graph.facebook.com/v23.0/${phone_number_id}/messages`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.WhatsApp_Token}`
            },
            data: data
        };

        logger.debug(`WhatsApp API request config - RequestID: ${requestId}`, {
            method: config.method,
            url: config.url,
            timeout: config.timeout,
            dataSize: JSON.stringify(data).length
        });

        const response = await axios.request(config);  // ⚡ AWAIT: Proper error handling
        
        logger.info(`WhatsApp API call successful - RequestID: ${requestId}`, {
            status: response.status,
            statusText: response.statusText,
            responseTime: response.headers['x-response-time'] || 'unknown'
        });
        
        // ⚡ METRICS: Record successful API call
        recordApiCall(true);
        
        return response;
        
    } catch (error) {
        // ⚡ SMART RETRY: Handle rate limiting and transient errors
        if (error.response?.status === 429) { // Rate limit exceeded
            logger.warn(`WhatsApp API rate limit exceeded - RequestID: ${requestId}, Retrying in 1 second`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return callWhatsAppAPI(data, phone_number_id); // Retry
        }
        
        // ⚡ ENHANCED RETRY LOGIC: Handle timeouts and network issues
        const isRetryableError = 
            (error.code === 'ECONNRESET' || 
             error.code === 'ETIMEDOUT' || 
             error.code === 'ENOTFOUND' ||
             error.code === 'ECONNABORTED' ||  // Axios timeout
             error.message?.includes('timeout') ||  // Various timeout messages
             (error.response?.status >= 500 && error.response?.status < 600));
        
        // Add retry count to prevent infinite loops
        const retryCount = error.retryCount || 0;
        const maxRetries = 3;  // Increased retries for timeout issues
        
        if (isRetryableError && retryCount < maxRetries) {
            // ⚡ ADAPTIVE RETRY DELAY: Longer delays for timeout errors
            const baseDelay = error.code === 'ECONNABORTED' || error.message?.includes('timeout') ? 2000 : 1000;
            const retryDelay = Math.min(baseDelay * Math.pow(2, retryCount), 10000); // Max 10s for timeouts
            
            logger.warn(`WhatsApp API temporary error - RequestID: ${requestId}, Retry ${retryCount + 1}/${maxRetries} in ${retryDelay}ms`, {
                errorCode: error.code,
                errorMessage: error.message,
                httpStatus: error.response?.status,
                retryCount: retryCount + 1,
                maxRetries: maxRetries,
                isTimeoutError: error.code === 'ECONNABORTED' || error.message?.includes('timeout'),
                retryDelay: retryDelay
            });
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            // Mark error with retry count to prevent infinite recursion
            const retryError = new Error(error.message);
            retryError.retryCount = retryCount + 1;
            retryError.code = error.code;
            
            return callWhatsAppAPI(data, phone_number_id);
        }
        
        // ⚡ ENHANCED ERROR LOGGING: Include operation context and detailed error info
        const errorContext = {
            requestId,
            phoneNumberId: phone_number_id,
            operation: 'callWhatsAppAPI',
            requestUrl: `https://graph.facebook.com/v23.0/${phone_number_id}/messages`,
            requestMethod: 'POST',
            requestDataSize: JSON.stringify(data).length,
            timestamp: new Date().toISOString(),
            errorType: error.constructor.name,
            errorMessage: error.message
        };
        
        if (error.response) {
            // Server responded with error status
            const responseData = typeof error.response.data === 'object' 
                ? JSON.stringify(error.response.data) 
                : error.response.data;
            
            // ⚡ ENHANCED 400 ERROR LOGGING: Capture specific WhatsApp API validation errors
            const errorLogData = {
                ...errorContext,
                httpStatus: error.response.status,
                httpStatusText: error.response.statusText,
                responseData: responseData,
                responseHeaders: error.response.headers,
                hasValidToken: !!process.env.WhatsApp_Token && process.env.WhatsApp_Token.length > 10,
                tokenPrefix: process.env.WhatsApp_Token ? process.env.WhatsApp_Token.substring(0, 10) + '...' : 'missing'
            };
            
            // Add specific analysis for 400 errors
            if (error.response.status === 400) {
                errorLogData.errorCategory = 'validation_error';
                errorLogData.commonCauses = [
                    'Invalid phone number format',
                    'Message content violates WhatsApp policies', 
                    'Invalid message structure/format',
                    'Missing required fields',
                    'Exceeded character limits'
                ];
                
                // ⚡ LOG REQUEST PAYLOAD for 400 errors to debug
                console.error('=== WHATSAPP 400 ERROR DEBUG ===');
                console.error('Request ID:', requestId);
                console.error('Phone Number ID:', phone_number_id);
                console.error('Payload Size:', JSON.stringify(data).length);
                console.error('Raw Data Type:', typeof data);
                console.error('Raw Data:', data);
                console.error('Parsed Data:', typeof data === 'string' ? JSON.parse(data) : data);
                console.error('==============================');
                
                logger.error(`Request payload context for 400 error - RequestID: ${requestId}`, {
                    requestPayload: data,
                    sanitizedPayload: JSON.stringify(data).replace(/("url":\s*")[^"]*(")/g, '$1[REDACTED_URL]$2'),
                    payloadSize: JSON.stringify(data).length,
                    phoneNumberId: phone_number_id,
                    timestamp: new Date().toISOString()
                });
                
                // Try to parse WhatsApp error details
                try {
                    const parsedError = typeof error.response.data === 'string' 
                        ? JSON.parse(error.response.data) 
                        : error.response.data;
                    
                    if (parsedError.error) {
                        errorLogData.whatsappError = {
                            message: parsedError.error.message,
                            type: parsedError.error.type,
                            code: parsedError.error.code,
                            error_subcode: parsedError.error.error_subcode,
                            fbtrace_id: parsedError.error.fbtrace_id
                        };
                        
                        // Add specific suggestions based on error codes
                        if (parsedError.error.code === 100) {
                            errorLogData.suggestion = 'Invalid parameter - check phone number format and message structure';
                        } else if (parsedError.error.code === 131030) {
                            errorLogData.suggestion = 'Recipient phone number not valid for WhatsApp Business API';
                        } else if (parsedError.error.code === 131026) {
                            errorLogData.suggestion = 'Message template or content violates WhatsApp policy';
                        } else if (parsedError.error.code === 131021) {
                            errorLogData.suggestion = 'Recipient has not accepted our new Terms of Service';
                        }
                        
                        // ⚡ DETAILED ANALYSIS: Check specific payload issues
                        if (data.type === 'interactive') {
                            errorLogData.interactiveAnalysis = {
                                hasButtons: !!(data.interactive?.action?.buttons),
                                buttonCount: data.interactive?.action?.buttons?.length || 0,
                                hasBody: !!(data.interactive?.body?.text),
                                bodyLength: data.interactive?.body?.text?.length || 0,
                                hasHeader: !!(data.interactive?.header),
                                hasFooter: !!(data.interactive?.footer),
                                actionType: data.interactive?.action?.type
                            };
                            
                            // Check for CTA URL issues
                            if (data.interactive?.action?.type === 'cta_url') {
                                const ctaUrl = data.interactive?.action?.parameters?.url;
                                errorLogData.ctaAnalysis = {
                                    hasUrl: !!ctaUrl,
                                    urlLength: ctaUrl?.length || 0,
                                    urlStartsWith: ctaUrl ? ctaUrl.substring(0, 20) : 'none',
                                    isHttps: ctaUrl?.startsWith('https://') || false
                                };
                            }
                        }
                    }
                } catch (parseError) {
                    errorLogData.parseError = 'Could not parse WhatsApp error response';
                }
            }
            
            logger.error(`WhatsApp API HTTP Error - RequestID: ${requestId}`, errorLogData);
        } else if (error.request) {
            // Request was made but no response received (network/timeout issues)
            const isTimeoutError = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
            
            logger.error(`WhatsApp API ${isTimeoutError ? 'Timeout' : 'Network'} Error - RequestID: ${requestId}`, {
                ...errorContext,
                errorCode: error.code,
                timeout: error.timeout,
                requestConfig: {
                    timeout: 30000,  // Updated timeout value
                    method: 'POST',
                    url: error.config?.url
                },
                networkError: !isTimeoutError,
                timeoutError: isTimeoutError,
                // ⚡ TIMEOUT-SPECIFIC CONTEXT
                ...(isTimeoutError && {
                    timeoutContext: {
                        configuredTimeout: '30000ms',
                        likelyRelative: 'Network latency between Cloud Run and WhatsApp API',
                        suggestions: [
                            'Check Cloud Run → WhatsApp API network latency',
                            'Consider increasing timeout for complex messages',
                            'Monitor WhatsApp API response times',
                            'Check if payload size affects response time'
                        ]
                    }
                })
            });
        } else {
            // Error in setting up the request
            logger.error(`WhatsApp API Request Setup Error - RequestID: ${requestId}`, {
                ...errorContext,
                errorStack: error.stack,
                configurationError: true
            });
        }
        
        // ⚡ ADDITIONAL CONTEXT: Log request payload (sanitized) - especially for 400 errors
        const sanitizedData = typeof data === 'string' ? JSON.parse(data) : data;
        if (sanitizedData) {
            // Remove sensitive data but keep structure for debugging
            const debugData = {
                messaging_product: sanitizedData.messaging_product,
                recipient_type: sanitizedData.recipient_type,
                type: sanitizedData.type,
                to: sanitizedData.to ? sanitizedData.to.toString().substring(0, 5) + '***' : undefined,
                hasText: !!sanitizedData.text,
                hasInteractive: !!sanitizedData.interactive,
                textLength: sanitizedData.text?.body?.length || 0
            };
            
            // ⚡ ENHANCED DEBUG FOR 400 ERRORS: Include more details
            if (error.response?.status === 400) {
                debugData.detailedPayload = {
                    ...sanitizedData,
                    to: sanitizedData.to ? sanitizedData.to.toString().substring(0, 5) + '***' : undefined
                };
                
                if (sanitizedData.interactive) {
                    debugData.interactiveDetails = {
                        type: sanitizedData.interactive.type,
                        hasBody: !!sanitizedData.interactive.body,
                        bodyTextLength: sanitizedData.interactive.body?.text?.length || 0,
                        hasHeader: !!sanitizedData.interactive.header,
                        headerTextLength: sanitizedData.interactive.header?.text?.length || 0,
                        hasFooter: !!sanitizedData.interactive.footer,
                        footerTextLength: sanitizedData.interactive.footer?.text?.length || 0,
                        hasAction: !!sanitizedData.interactive.action
                    };
                    
                    if (sanitizedData.interactive.type === 'cta_url' && sanitizedData.interactive.action) {
                        debugData.ctaUrlDetails = {
                            hasParameters: !!sanitizedData.interactive.action.parameters,
                            hasUrl: !!sanitizedData.interactive.action.parameters?.url,
                            hasDisplayText: !!sanitizedData.interactive.action.parameters?.display_text,
                            urlPreview: sanitizedData.interactive.action.parameters?.url?.substring(0, 50) + '...' || 'none'
                        };
                    }
                }
            }
            
            logger.error(`Request payload context for ${error.response?.status || 'unknown'} error - RequestID: ${requestId}`, debugData);
        }
        
        // ⚡ METRICS: Record failed API call
        recordApiCall(false, error);
        
        throw error;
    }
}

export async function sendWatsAppText(textResponse, to, phone_number_id) {
    logger.info(`Sending WhatsApp text message - To: ${to}, PhoneID: ${phone_number_id}, Text length: ${textResponse?.length || 0}`);
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {
            "preview_url": false,
            "body": trimString(textResponse, 4096)
        }
    });

    logger.debug(`WhatsApp text message data prepared`, {
        to: to,
        textLength: textResponse?.length || 0,
        trimmedLength: trimString(textResponse, 4096).length,
        dataSize: data.length
    });

    return callWhatsAppAPI(data, phone_number_id);
}

export async function sendWatsAppReplyText(textResponse, message_id, to, phone_number_id) {
    logger.info(`Sending WhatsApp reply message - To: ${to}, PhoneID: ${phone_number_id}, ReplyTo: ${message_id}, Text length: ${textResponse?.length || 0}`);
    
    if (message_id == null) {
        logger.warn(`Message ID is null, falling back to regular text message - To: ${to}`);
        return sendWatsAppText(textResponse, to, phone_number_id);
    }
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "context": {
            "message_id": message_id
        },
        "type": "text",
        "text": {
            "preview_url": false,
            "body": trimString(textResponse, 4096)
        }
    });

    logger.debug(`WhatsApp reply message data prepared`, {
        to: to,
        replyTo: message_id,
        textLength: textResponse?.length || 0,
        dataSize: data.length
    });

    return callWhatsAppAPI(data, phone_number_id);
}

export async function sendWatsAppVideo(to, phone_number_id) {
    logger.info(`Sending WhatsApp video message - To: ${to}, PhoneID: ${phone_number_id}`);
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "video",
        "video": {
            "id": "495841383370609", /* Only if using uploaded media */
            "caption": "Introduction to EqualJustice.ai"
        }
    });

    logger.debug(`WhatsApp video message data prepared`, {
        to: to,
        videoId: "495841383370609",
        caption: "Introduction to EqualJustice.ai"
    });

    return callWhatsAppAPI(data, phone_number_id);
}

export async function markAsRead(message_id, phone_number_id) {
    logger.debug(`Marking message as read - MessageID: ${message_id}, PhoneID: ${phone_number_id}`);
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id
    });

    // Currently disabled - uncomment if needed
    // callWhatsAppAPI(data, phone_number_id);
    logger.debug(`Mark as read disabled for message: ${message_id}`);
}

export async function getWAMediaURL(mediaId, phone_number_id) {
    logger.info(`Getting WhatsApp media URL - MediaID: ${mediaId}, PhoneID: ${phone_number_id}`);
    
    try {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            timeout: 10000,
            url: `https://graph.facebook.com/v23.0/${mediaId}?phone_number_id=${phone_number_id}`,
            headers: {
                'Authorization': `Bearer ${process.env.WhatsApp_Token}`
            }
        };

        logger.debug(`Media URL request config`, {
            mediaId: mediaId,
            phoneId: phone_number_id,
            timeout: config.timeout
        });

        const response = await axios.request(config);
        logger.info(`Media URL retrieved successfully - MediaID: ${mediaId}`, {
            status: response.status,
            url: response.data.url,
            mimeType: response.data.mime_type
        });
        
        return response.data;
        
    } catch (error) {
        logger.error(`Error getting media URL - MediaID: ${mediaId}`, {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        throw error;
    }
}

export async function downloadWAFile(mediaUrl, filename) {
    logger.info(`Downloading WhatsApp file - Filename: ${filename}, URL: ${mediaUrl}`);
    
    return new Promise((resolve, reject) => {
        try {
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                timeout: 30000, // 30 seconds for file download
                url: mediaUrl,
                headers: {
                    'Authorization': process.env.WhatsApp_Token,
                },
                responseType: 'stream',
            };

            logger.debug(`File download config`, {
                filename: filename,
                timeout: config.timeout,
                responseType: config.responseType
            });

            axios.request(config)
                .then((response) => {
                    const mediaPath = path.resolve('./CloudStorage', filename);
                    logger.debug(`File download started - Path: ${mediaPath}`);

                    const writer = fs.createWriteStream(mediaPath);

                    response.data.pipe(writer);

                    writer.on('finish', () => {
                        logger.info(`File download completed - Path: ${mediaPath}, Size: ${response.headers['content-length'] || 'unknown'} bytes`);
                        resolve(mediaPath);
                    });

                    writer.on('error', (err) => {
                        logger.error(`File write error - Path: ${mediaPath}`, err);
                        reject(err);
                    });
                })
                .catch((error) => {
                    logger.error(`File download request failed - Filename: ${filename}`, {
                        error: error.message,
                        status: error.response?.status
                    });
                    reject(error);
                });
                
        } catch (error) {
            logger.error(`File download setup error - Filename: ${filename}`, error);
            reject(error);
        }
    });
}

export async function sendWatsAppWithButtons(textResponse, buttons, footer = '', to, phone_number_id) {
    logger.info(`Sending WhatsApp buttons message - To: ${to}, PhoneID: ${phone_number_id}, Buttons: ${buttons?.length || 0}, Text length: ${textResponse?.length || 0}`);
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": trimString(textResponse, 1024)
            },
            "footer": {
                "text": trimString(footer, 60)
            },
            "action": {
                buttons
            }
        }
    });

    logger.debug(`WhatsApp buttons message data prepared`, {
        to: to,
        textLength: textResponse?.length || 0,
        buttonCount: buttons?.length || 0,
        footerLength: footer?.length || 0,
        dataSize: data.length
    });

    return callWhatsAppAPI(data, phone_number_id);
}

export async function sendWatsAppWithList(textResponse, sections, header = '', footer = '', to, phone_number_id) {
    logger.info(`Sending WhatsApp list message - To: ${to}, PhoneID: ${phone_number_id}, Sections: ${sections?.length || 0}, Text length: ${textResponse?.length || 0}`);
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": {
                "type": "text",
                "text": trimString(header, 60)
            },
            "body": {
                "text": trimString(textResponse, 4096)
            },
            "footer": {
                "text": trimString(footer, 60)
            },
            "action": sections
        }
    });

    logger.debug(`WhatsApp list message data prepared`, {
        to: to,
        textLength: textResponse?.length || 0,
        sectionCount: sections?.length || 0,
        headerLength: header?.length || 0,
        footerLength: footer?.length || 0,
        dataSize: data.length
    });

    return callWhatsAppAPI(data, phone_number_id);
}

export async function sendWatsAppWithRedirectButton(textResponse, file, header = '', footer = '', to, phone_number_id) {
    logger.info(`Sending WhatsApp redirect button - To: ${to}, PhoneID: ${phone_number_id}, File: ${file?.name || 'unknown'}, Text length: ${textResponse?.length || 0}`);
    
    try {
        // ⚡ VALIDATION: Ensure file object has required structure for WhatsApp CTA
        if (!file || !file.parameters || !file.parameters.url || !file.parameters.display_text) {
            logger.error(`Invalid file object for redirect button - To: ${to}`, {
                file: file,
                hasFile: !!file,
                hasParameters: !!(file?.parameters),
                hasUrl: !!(file?.parameters?.url),
                hasDisplayText: !!(file?.parameters?.display_text)
            });
            throw new Error('Invalid file object: missing required parameters for WhatsApp CTA button');
        }
        
        // ⚡ URL VALIDATION: Ensure URL is valid and HTTPS
        try {
            const urlObj = new URL(file.parameters.url);
            if (urlObj.protocol !== 'https:') {
                throw new Error(`URL must use HTTPS protocol, got: ${urlObj.protocol}`);
            }
        } catch (urlError) {
            logger.error(`Invalid URL for CTA button - To: ${to}`, {
                url: file.parameters.url,
                error: urlError.message
            });
            throw new Error(`Invalid URL for CTA button: ${urlError.message}`);
        }
        
        // ⚡ SANITIZE: Ensure text fields don't exceed WhatsApp limits
        const sanitizedHeader = header ? trimString(header, 60) : '';
        const sanitizedFooter = footer ? trimString(footer, 60) : '';
        const sanitizedBody = textResponse ? trimString(textResponse, 1024) : '';
        const sanitizedDisplayText = trimString(file.parameters.display_text, 20);
        
        // ⚡ FIX: Create proper CTA URL action structure according to WhatsApp API
        const ctaAction = {
            "name": "cta_url",
            "parameters": {
                "display_text": sanitizedDisplayText,
                "url": file.parameters.url
            }
        };
        
        // ⚡ CONDITIONAL HEADER: Only include header if it has content
        const interactive = {
                "type": "cta_url",
                "body": {
                    "text": sanitizedBody
                },
            "action": ctaAction
        };
        
        // Add header only if it has content
        if (sanitizedHeader && sanitizedHeader.trim().length > 0) {
            interactive.header = {
                "type": "text",
                "text": sanitizedHeader
            };
        }
        
        // Add footer only if it has content
        if (sanitizedFooter && sanitizedFooter.trim().length > 0) {
            interactive.footer = {
                    "text": sanitizedFooter
            };
        }
        
        const data = JSON.stringify({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": interactive
        });

        // ⚡ DEBUG: Log final structure being sent to WhatsApp API
        console.log('=== REDIRECT BUTTON DEBUG ===');
        console.log('To:', to);
        console.log('Interactive Object:', JSON.stringify(interactive, null, 2));
        console.log('Full Payload:', JSON.stringify(JSON.parse(data), null, 2));
        console.log('Payload Size:', data.length);
        console.log('============================');

        logger.debug(`WhatsApp redirect button data prepared`, {
            to: to,
            textLength: textResponse?.length || 0,
            sanitizedBodyLength: sanitizedBody.length,
            fileName: file?.name || 'unknown',
            fileUrl: file?.parameters?.url?.substring(0, 50) + '...',
            headerLength: header?.length || 0,
            footerLength: footer?.length || 0,
            dataSize: data.length
        });

        return await callWhatsAppAPI(data, phone_number_id);
        
    } catch (error) {
        logger.error(`Error in sendWatsAppWithRedirectButton - To: ${to}`, {
            error: error.message,
            stack: error.stack,
            file: file,
            textResponse: textResponse?.substring(0, 100)
        });
        
        // Re-throw the error so it can be caught by the caller (sendWhatsAppFileLink)
        throw error;
    }
}

export async function sendWhatsAppFileLink(textResponse, file, header = '', footer = '', to, phone_number_id) {
    const startTime = Date.now();
    const linkRequestId = `filelink_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    logger.info(`Starting WhatsApp file link process`, {
        to: to,
        phoneNumberId: phone_number_id,
        fileName: file?.name || 'unknown',
        textLength: textResponse?.length || 0,
        header: header,
        footer: footer,
        fileUrl: file?.parameters?.url,
        linkRequestId: linkRequestId,
        timestamp: new Date().toISOString()
    });
    
    try {
        // ⚡ VALIDATION: Check if file object is properly structured
        if (!file || !file.parameters || !file.parameters.url) {
            logger.error(`Invalid file object for file link - To: ${to}`, {
                file: file,
                hasFile: !!file,
                hasParameters: !!(file?.parameters),
                hasUrl: !!(file?.parameters?.url)
            });
            
            // Send fallback message instead of crashing
            await sendWatsAppText("Your document is being processed. You will receive a direct download link shortly via SMS or email.", to, phone_number_id);
            return false;
        }
        
        let fileAvailable = false;
        let counter = 0;
        const maxWaitTime = 30000; // ⚡ TOTAL TIMEOUT: 30 seconds max instead of 150 seconds
        const checkInterval = 3000; // ⚡ CHECK INTERVAL: 3 seconds instead of 15 seconds
        
        // ⚡ PROGRESS TRACKING: User feedback
        logger.debug(`File link process started - Max wait: ${maxWaitTime}ms, Check interval: ${checkInterval}ms`);
        
        try {
            await sendWatsAppText("Processing your document...", to, phone_number_id);
            logger.debug(`Processing message sent - To: ${to}`);
        } catch (progressError) {
            logger.warn(`Failed to send progress message - To: ${to}`, { error: progressError.message });
            // Continue with file processing even if progress message fails
        }
        
        while (!fileAvailable && counter < 10) {
            const attemptStart = Date.now();
            logger.info(`File availability check attempt ${counter + 1}/10`, {
                to: to,
                fileUrl: file.parameters.url,
                attempt: counter + 1,
                maxAttempts: 10,
                elapsedTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
            
            try {
                fileAvailable = await checkFileAvailability(file.parameters.url);
                
                const attemptTime = Date.now() - attemptStart;
                logger.debug(`File availability check completed`, {
                    to: to,
                    attempt: counter + 1,
                    fileAvailable: fileAvailable,
                    attemptTimeMs: attemptTime,
                    url: file.parameters.url
                });
                
            } catch (checkError) {
                const attemptTime = Date.now() - attemptStart;
                logger.warn(`File availability check failed`, {
                    to: to,
                    attempt: counter + 1,
                    maxAttempts: 10,
                    error: checkError.message,
                    attemptTimeMs: attemptTime,
                    url: file.parameters.url,
                    errorType: checkError.constructor.name
                });
                fileAvailable = false;
            }
            
            if (fileAvailable) {
                const totalWaitTime = Date.now() - startTime;
                logger.info(`File became available - sending to user`, {
                    to: to,
                    checksRequired: counter + 1,
                    totalWaitTimeMs: totalWaitTime,
                    url: file.parameters.url,
                    fileName: file.name || 'unknown'
                });
                
                try {
                    logger.debug(`Attempting to send WhatsApp redirect button`, {
                        to: to,
                        textResponse: textResponse?.substring(0, 100) + '...',
                        header: header,
                        footer: footer,
                        fileName: file.name
                    });
                    
                    await sendWatsAppWithRedirectButton(textResponse, file, header, footer, to, phone_number_id);
                    
                    logger.info(`File redirect button sent successfully`, {
                        to: to,
                        fileName: file.name || 'unknown',
                        url: file.parameters.url,
                        checksRequired: counter + 1,
                        totalWaitTimeMs: totalWaitTime,
                        deliveryMethod: 'whatsapp_cta_button'
                    });
                    return true;
                    
                } catch (redirectError) {
                    logger.error(`Failed to send file redirect button`, {
                        to: to,
                        fileName: file.name || 'unknown',
                        error: redirectError.message,
                        stack: redirectError.stack,
                        file: file,
                        totalWaitTimeMs: totalWaitTime
                    });
                    
                    // ⚡ FALLBACK: Send file URL as plain text if WhatsApp redirect button fails
                    try {
                        const fallbackMessage = `Your document is ready! Download it here: ${file.parameters.url}`;
                        
                        logger.info(`Attempting fallback text message delivery`, {
                            to: to,
                            fallbackMessage: fallbackMessage,
                            fileName: file.name || 'unknown'
                        });
                        
                        await sendWatsAppText(fallbackMessage, to, phone_number_id);
                        
                        logger.info(`Fallback file URL sent as text message`, {
                            to: to,
                            fileName: file.name || 'unknown',
                            url: file.parameters.url,
                            deliveryMethod: 'plain_text_fallback',
                            totalWaitTimeMs: totalWaitTime
                        });
                        return true;
                        
                    } catch (fallbackError) {
                        logger.error(`All delivery methods failed for file`, {
                            to: to,
                            fileName: file.name || 'unknown',
                            url: file.parameters.url,
                            redirectError: redirectError.message,
                            fallbackError: fallbackError.message,
                            totalWaitTimeMs: totalWaitTime
                        });
                        return false;
                    }
                }
            }
            
            // ⚡ PROGRESSIVE DELAY: 3s, 6s, 9s, 12s, 15s instead of fixed 15s
            const delay = checkInterval * (counter + 1);
            
            logger.debug(`File not available yet - scheduling next check`, {
                to: to,
                attempt: counter + 1,
                nextCheckInMs: delay,
                totalElapsedMs: Date.now() - startTime,
                url: file.parameters.url
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
            counter++;
            
            // ⚡ USER UPDATES: Keep user informed (with error handling)
            try {
                let updateMessage = null;
                if (counter === 3) {
                    updateMessage = "Still processing your document, please wait...";
                } else if (counter === 6) {
                    updateMessage = "Document processing is taking longer than expected...";
                }
                
                if (updateMessage) {
                    logger.info(`Sending progress update to user`, {
                        to: to,
                        updateNumber: counter === 3 ? 1 : 2,
                        message: updateMessage,
                        elapsedTimeMs: Date.now() - startTime
                    });
                    
                    await sendWatsAppText(updateMessage, to, phone_number_id);
                    
                    logger.debug(`Progress update sent successfully`, {
                        to: to,
                        updateNumber: counter === 3 ? 1 : 2,
                        elapsedTimeMs: Date.now() - startTime
                    });
                }
                
            } catch (updateError) {
                logger.warn(`Failed to send progress update`, {
                    to: to,
                    updateAttempt: counter === 3 ? 1 : 2,
                    error: updateError.message,
                    elapsedTimeMs: Date.now() - startTime
                });
                // Continue processing even if update messages fail
            }
        }
        
        // ⚡ USER FEEDBACK: Clear communication on failure
        if (!fileAvailable) {
            const totalTimeoutTime = Date.now() - startTime;
            
            logger.error(`File processing timeout - file never became available`, {
                to: to,
                checksPerformed: counter,
                maxChecks: 10,
                totalTimeoutTimeMs: totalTimeoutTime,
                totalTimeoutTimeMinutes: (totalTimeoutTime / 60000).toFixed(2),
                url: file.parameters.url,
                fileName: file.name || 'unknown',
                checkInterval: checkInterval,
                maxWaitTime: maxWaitTime,
                lastCheckStatus: 'unavailable'
            });
            
            try {
                const timeoutMessage = "Document processing is taking longer than expected. Please try again in a few minutes.";
                
                logger.info(`Sending timeout notification to user`, {
                    to: to,
                    message: timeoutMessage,
                    totalTimeoutTimeMs: totalTimeoutTime
                });
                
                await sendWatsAppText(timeoutMessage, to, phone_number_id);
                
                logger.debug(`Timeout notification sent successfully`, {
                    to: to,
                    totalTimeoutTimeMs: totalTimeoutTime
                });
                
            } catch (timeoutError) {
                logger.error(`Failed to send timeout notification`, {
                    to: to,
                    timeoutError: timeoutError.message,
                    totalTimeoutTimeMs: totalTimeoutTime,
                    originalUrl: file.parameters.url
                });
            }
        }
        
        return false;
        
    } catch (error) {
        const totalErrorTime = Date.now() - startTime;
        
        logger.error(`Critical error in sendWhatsAppFileLink`, {
            to: to,
            phoneNumberId: phone_number_id,
            linkRequestId: linkRequestId,
            error: error.message,
            stack: error.stack,
            errorType: error.constructor.name,
            file: {
                name: file?.name || 'unknown',
                hasParameters: !!(file?.parameters),
                hasUrl: !!(file?.parameters?.url),
                url: file?.parameters?.url?.substring(0, 100) + '...' || 'none'
            },
            textResponse: textResponse?.substring(0, 100) + '...' || 'none',
            totalErrorTimeMs: totalErrorTime,
            timestamp: new Date().toISOString()
        });
        
        // ⚡ EMERGENCY FALLBACK: Send basic message with enhanced logging
        try {
            const emergencyMessage = "There was an issue processing your document. Our team will review and send it to you shortly.";
            
            logger.info(`Sending emergency fallback message`, {
                to: to,
                linkRequestId: linkRequestId,
                message: emergencyMessage,
                originalError: error.message
            });
            
            await sendWatsAppText(emergencyMessage, to, phone_number_id);
            
            logger.info(`Emergency fallback message sent successfully`, {
                to: to,
                linkRequestId: linkRequestId,
                totalErrorTimeMs: totalErrorTime
            });
            
        } catch (emergencyError) {
            logger.error(`Emergency fallback also failed - complete failure`, {
                to: to,
                linkRequestId: linkRequestId,
                originalError: error.message,
                emergencyError: emergencyError.message,
                totalErrorTimeMs: totalErrorTime,
                criticalFailure: true
            });
        }
        
        return false;
    }
}

import paymentConfig from '../config/payment.js';

export function sendWhatsAppOrderForPayment(textResponse, p, reference_id, to, phone_number_id) {
    logger.info(`Sending WhatsApp payment order - To: ${to}, PhoneID: ${phone_number_id}, Reference: ${reference_id}, Amount: ${p.sale_amount + p.tax - p.discount}`);
    
    // Use configurable access duration (default 2 hours) minus 2 minutes for buffer
    const expirationBufferMs = 2 * 60 * 1000; // 2 minutes buffer
    const expirationTime = Math.floor((Date.now() + paymentConfig.getAccessDurationMs() - expirationBufferMs) / 1000).toString();
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "order_details",
            "body": {
                "text": textResponse
            },
            "footer": {
                "text": "EqualJustice.ai"
            },
            "action": {
                "name": "review_and_pay",
                "parameters": {
                    "reference_id": reference_id,
                    "type": "digital-goods",
                    "payment_settings": [
                        {
                            "type": "payment_gateway",
                            "payment_gateway": {
                                "type": "razorpay",
                                "configuration_name": p.configName,
                                "razorpay": {
                                    "receipt": "receipt-value",
                                    "notes": {
                                        "customer_phone_number": to
                                    }
                                }
                            }
                        }
                    ],
                    "currency": "INR",
                    "total_amount": {
                        "value": p.sale_amount + p.tax - p.discount,
                        "offset": 100
                    },
                    "order": {
                        "status": "pending",
                        "expiration": {
                            "timestamp": expirationTime,
                            "description": "Time limit expired"
                        },
                        "items": [
                            {
                                "retailer_id": "1919",
                                "name": "Invoice / Payment Slip",
                                "amount": {
                                    "value": p.amount,
                                    "offset": 100
                                },
                                "sale_amount": {
                                    "value": p.sale_amount,
                                    "offset": 100
                                },
                                "quantity": 1
                            }
                        ],
                        "subtotal": {
                            "value": p.sale_amount,
                            "offset": 100
                        },
                        "tax": {
                            "value": p.tax,
                            "offset": 100,
                            "description": "Tax"
                        },
                        "discount": {
                            "value": p.discount,
                            "offset": 100,
                            "description": "Launch offer",
                            "discount_program_name": "Launch"
                        }
                    }
                }
            }
        }
    });

    logger.debug(`WhatsApp payment order data prepared`, {
        to: to,
        referenceId: reference_id,
        amount: p.sale_amount + p.tax - p.discount,
        currency: 'INR',
        expiration: expirationTime,
        dataSize: data.length
    });

    return callWhatsAppAPI(data, phone_number_id);
}

export function sendWhatsAppOrderStatus(textResponse, reference_id, status, description, to, phone_number_id) {
    logger.info(`Sending WhatsApp order status - To: ${to}, PhoneID: ${phone_number_id}, Reference: ${reference_id}, Status: ${status}, Description: ${description}`);
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "order_status",
            "body": {
                "text": textResponse
            },
            "action": {
                "name": "review_order",
                "parameters": {
                    "reference_id": reference_id,
                    "order": {
                        "status": status,
                        "description": description
                    }
                }
            }
        }
    });

    logger.debug(`WhatsApp order status data prepared`, {
        to: to,
        referenceId: reference_id,
        status: status,
        description: description,
        dataSize: data.length
    });

    return callWhatsAppAPI(data, phone_number_id);
}


