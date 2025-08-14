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

async function callWhatsAppAPI(data, phone_number_id) {
    const requestId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`WhatsApp API call started - RequestID: ${requestId}, PhoneID: ${phone_number_id}`);
    
    try {
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
        
        return response;
        
    } catch (error) {
        // ⚡ SMART RETRY: Handle rate limiting
        if (error.response?.status === 429) { // Rate limit exceeded
            logger.warn(`WhatsApp API rate limit exceeded - RequestID: ${requestId}, Retrying in 1 second`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return callWhatsAppAPI(data, phone_number_id); // Retry
        }
        
        // ⚡ BETTER ERROR LOGGING: Structured error handling
        if (error.response) {
            logger.error(`WhatsApp API Error - RequestID: ${requestId}`, {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            });
        } else if (error.request) {
            logger.error(`WhatsApp API Error - No response received - RequestID: ${requestId}`, {
                request: error.request,
                message: error.message
            });
        } else {
            logger.error(`WhatsApp API Error - Request setup failed - RequestID: ${requestId}`, {
                message: error.message,
                stack: error.stack
            });
        }
        
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
    
    let data = JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "cta_url",
            "header": {
                "type": "text",
                "text": header
            },
            "body": {
                "text": textResponse
            },
            "footer": {
                "text": footer
            },
            "action": file
        }
    });

    logger.debug(`WhatsApp redirect button data prepared`, {
        to: to,
        textLength: textResponse?.length || 0,
        fileName: file?.name || 'unknown',
        headerLength: header?.length || 0,
        footerLength: footer?.length || 0,
        dataSize: data.length
    });

    return callWhatsAppAPI(data, phone_number_id);
}

export async function sendWhatsAppFileLink(textResponse, file, header = '', footer = '', to, phone_number_id) {
    logger.info(`Sending WhatsApp file link - To: ${to}, PhoneID: ${phone_number_id}, File: ${file?.name || 'unknown'}, Text length: ${textResponse?.length || 0}`);
    
    let fileAvailable = false;
    let counter = 0;
    const maxWaitTime = 30000; // ⚡ TOTAL TIMEOUT: 30 seconds max instead of 150 seconds
    const checkInterval = 3000; // ⚡ CHECK INTERVAL: 3 seconds instead of 15 seconds
    
    // ⚡ PROGRESS TRACKING: User feedback
    logger.debug(`File link process started - Max wait: ${maxWaitTime}ms, Check interval: ${checkInterval}ms`);
    const progressMessage = sendWatsAppText("Processing your document...", to, phone_number_id);
    
    while (!fileAvailable && counter < 10) {
        logger.debug(`File availability check #${counter + 1}/10 - URL: ${file.parameters.url}`);
        
        fileAvailable = await checkFileAvailability(file.parameters.url);
        
        if (fileAvailable) {
            logger.info(`File available after ${counter + 1} checks - URL: ${file.parameters.url}`);
            await sendWatsAppWithRedirectButton(textResponse, file, header, footer, to, phone_number_id);
            return true;
        }
        
        // ⚡ PROGRESSIVE DELAY: 3s, 6s, 9s, 12s, 15s instead of fixed 15s
        const delay = checkInterval * (counter + 1);
        logger.debug(`File not available, waiting ${delay}ms before next check`);
        await new Promise(resolve => setTimeout(resolve, delay));
        counter++;
        
        // ⚡ USER UPDATES: Keep user informed
        if (counter === 3) {
            logger.info(`Sending progress update #1 to user ${to}`);
            sendWatsAppText("Still processing your document, please wait...", to, phone_number_id);
        } else if (counter === 6) {
            logger.info(`Sending progress update #2 to user ${to}`);
            sendWatsAppText("Document processing is taking longer than expected...", to, phone_number_id);
        }
    }
    
    // ⚡ USER FEEDBACK: Clear communication on failure
    if (!fileAvailable) {
        logger.warn(`File processing timeout after ${counter} checks - URL: ${file.parameters.url}`);
        sendWatsAppText("Document processing is taking longer than expected. Please try again in a few minutes.", to, phone_number_id);
    }
    
    return false;
}

export function sendWhatsAppOrderForPayment(textResponse, p, reference_id, to, phone_number_id) {
    logger.info(`Sending WhatsApp payment order - To: ${to}, PhoneID: ${phone_number_id}, Reference: ${reference_id}, Amount: ${p.sale_amount + p.tax - p.discount}`);
    
    const expirationTime = Math.floor((Date.now() + 6960000) / 1000).toString(); // 1hour58min
    
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


