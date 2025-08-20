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
    } else {
        try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            if (!parsedData.messaging_product || parsedData.messaging_product !== 'whatsapp') {
                errors.push('Invalid messaging_product in data payload');
            }
            if (!parsedData.to) {
                errors.push('Missing recipient (to) in data payload');
            }
        } catch (parseError) {
            errors.push('Invalid JSON in data payload');
        }
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
            logger.error(`WhatsApp API Validation Error - RequestID: ${requestId}`, {
                errors: validationErrors,
                phoneNumberId: phone_number_id,
                requestId
            });
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
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
            timeout: 10000,  // ⚡ TIMEOUT: 10 second max
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
        
        // ⚡ RETRY LOGIC: Handle temporary network issues (5xx errors, timeouts)
        const isRetryableError = 
            (error.code === 'ECONNRESET' || 
             error.code === 'ETIMEDOUT' || 
             error.code === 'ENOTFOUND' ||
             (error.response?.status >= 500 && error.response?.status < 600));
        
        // Add retry count to prevent infinite loops
        const retryCount = error.retryCount || 0;
        const maxRetries = 2;
        
        if (isRetryableError && retryCount < maxRetries) {
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
            logger.warn(`WhatsApp API temporary error - RequestID: ${requestId}, Retry ${retryCount + 1}/${maxRetries} in ${retryDelay}ms`, {
                errorCode: error.code,
                httpStatus: error.response?.status,
                retryCount: retryCount + 1
            });
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            // Mark error with retry count to prevent infinite recursion
            const retryError = new Error(error.message);
            retryError.retryCount = retryCount + 1;
            
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
            
            logger.error(`WhatsApp API HTTP Error - RequestID: ${requestId}`, {
                ...errorContext,
                httpStatus: error.response.status,
                httpStatusText: error.response.statusText,
                responseData: responseData,
                responseHeaders: error.response.headers,
                hasValidToken: !!process.env.WhatsApp_Token && process.env.WhatsApp_Token.length > 10,
                tokenPrefix: process.env.WhatsApp_Token ? process.env.WhatsApp_Token.substring(0, 10) + '...' : 'missing'
            });
        } else if (error.request) {
            // Request was made but no response received (network/timeout issues)
            logger.error(`WhatsApp API Network Error - RequestID: ${requestId}`, {
                ...errorContext,
                errorCode: error.code,
                timeout: error.timeout,
                requestConfig: {
                    timeout: 10000,
                    method: 'POST',
                    url: error.config?.url
                },
                networkError: true
            });
        } else {
            // Error in setting up the request
            logger.error(`WhatsApp API Request Setup Error - RequestID: ${requestId}`, {
                ...errorContext,
                errorStack: error.stack,
                configurationError: true
            });
        }
        
        // ⚡ ADDITIONAL CONTEXT: Log request payload (sanitized)
        const sanitizedData = typeof data === 'string' ? JSON.parse(data) : data;
        if (sanitizedData) {
            // Remove sensitive data but keep structure for debugging
            const debugData = {
                messaging_product: sanitizedData.messaging_product,
                recipient_type: sanitizedData.recipient_type,
                type: sanitizedData.type,
                to: sanitizedData.to ? sanitizedData.to.substring(0, 5) + '...' : undefined,
                hasText: !!sanitizedData.text,
                hasInteractive: !!sanitizedData.interactive,
                textLength: sanitizedData.text?.body?.length || 0
            };
            logger.debug(`Request payload context - RequestID: ${requestId}`, debugData);
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
        
        // ⚡ SANITIZE: Ensure text fields don't exceed WhatsApp limits
        const sanitizedHeader = header ? header.substring(0, 60) : '';
        const sanitizedFooter = footer ? footer.substring(0, 60) : '';
        const sanitizedBody = textResponse ? textResponse.substring(0, 1024) : '';
        
        let data = JSON.stringify({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "cta_url",
                "header": {
                    "type": "text",
                    "text": sanitizedHeader
                },
                "body": {
                    "text": sanitizedBody
                },
                "footer": {
                    "text": sanitizedFooter
                },
                "action": file
            }
        });

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
    logger.info(`Sending WhatsApp file link - To: ${to}, PhoneID: ${phone_number_id}, File: ${file?.name || 'unknown'}, Text length: ${textResponse?.length || 0}`);
    
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
            logger.debug(`File availability check #${counter + 1}/10 - URL: ${file.parameters.url}`);
            
            try {
                fileAvailable = await checkFileAvailability(file.parameters.url);
            } catch (checkError) {
                logger.warn(`File availability check failed - To: ${to}, Attempt: ${counter + 1}`, {
                    error: checkError.message,
                    url: file.parameters.url
                });
                fileAvailable = false;
            }
            
            if (fileAvailable) {
                logger.info(`File available after ${counter + 1} checks - URL: ${file.parameters.url}`);
                
                try {
                    await sendWatsAppWithRedirectButton(textResponse, file, header, footer, to, phone_number_id);
                    logger.info(`File redirect button sent successfully - To: ${to}`);
                    return true;
                } catch (redirectError) {
                    logger.error(`Failed to send file redirect button - To: ${to}`, {
                        error: redirectError.message,
                        stack: redirectError.stack,
                        file: file
                    });
                    
                    // ⚡ FALLBACK: Send file URL as plain text if WhatsApp redirect button fails
                    try {
                        const fallbackMessage = `Your document is ready! Download it here: ${file.parameters.url}`;
                        await sendWatsAppText(fallbackMessage, to, phone_number_id);
                        logger.info(`Fallback file URL sent as text - To: ${to}`);
                        return true;
                    } catch (fallbackError) {
                        logger.error(`Fallback file URL also failed - To: ${to}`, {
                            error: fallbackError.message
                        });
                        return false;
                    }
                }
            }
            
            // ⚡ PROGRESSIVE DELAY: 3s, 6s, 9s, 12s, 15s instead of fixed 15s
            const delay = checkInterval * (counter + 1);
            logger.debug(`File not available, waiting ${delay}ms before next check`);
            await new Promise(resolve => setTimeout(resolve, delay));
            counter++;
            
            // ⚡ USER UPDATES: Keep user informed (with error handling)
            try {
                if (counter === 3) {
                    logger.info(`Sending progress update #1 to user ${to}`);
                    await sendWatsAppText("Still processing your document, please wait...", to, phone_number_id);
                } else if (counter === 6) {
                    logger.info(`Sending progress update #2 to user ${to}`);
                    await sendWatsAppText("Document processing is taking longer than expected...", to, phone_number_id);
                }
            } catch (updateError) {
                logger.warn(`Failed to send progress update - To: ${to}`, { error: updateError.message });
                // Continue processing even if update messages fail
            }
        }
        
        // ⚡ USER FEEDBACK: Clear communication on failure
        if (!fileAvailable) {
            logger.warn(`File processing timeout after ${counter} checks - URL: ${file.parameters.url}`);
            
            try {
                await sendWatsAppText("Document processing is taking longer than expected. Please try again in a few minutes.", to, phone_number_id);
            } catch (timeoutError) {
                logger.error(`Failed to send timeout message - To: ${to}`, { error: timeoutError.message });
            }
        }
        
        return false;
        
    } catch (error) {
        logger.error(`Critical error in sendWhatsAppFileLink - To: ${to}`, {
            error: error.message,
            stack: error.stack,
            file: file,
            textResponse: textResponse?.substring(0, 100)
        });
        
        // ⚡ EMERGENCY FALLBACK: Send basic message
        try {
            await sendWatsAppText("There was an issue processing your document. Our team will review and send it to you shortly.", to, phone_number_id);
        } catch (emergencyError) {
            logger.error(`Emergency fallback also failed - To: ${to}`, { error: emergencyError.message });
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


