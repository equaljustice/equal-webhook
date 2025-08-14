import * as types from '../utils/types.js';
import { logger } from '../utils/logging.js';
import { extractTextFromDocument, deleteFile } from '../utils/readFileData.js';
import { markAsRead, sendWatsAppText, sendWatsAppReplyText, getWAMediaURL, downloadWAFile, sendWatsAppWithButtons, sendWatsAppWithList, sendWhatsAppFileLink, sendWatsAppVideo, sendWhatsAppOrderForPayment, sendWhatsAppOrderStatus } from '../whatsApp/whatsAppAPI.js';
import { interactWithAssistant, createAssistantThread } from "../chatGPT/helpers/assistant-api.js";
import { deleteSession, getSession, saveSession, updateSessionWithNewThread, updateSessionWithPayment } from '../Services/redis/redisWASession.js';
import { getActionFromDFES } from '../Services/Dialogflow/detectIntentES.js';
import { getCXEventResponse, getCXResponse } from '../Services/Dialogflow/detectIntentCX.js';
import { DFchipsToButtonOrList } from '../whatsApp/DFchipsToButtons.js';
import { convertMarkdownToWhatsApp } from '../whatsApp/markdownToWA.js';
import { generateId } from '../utils/generateID.js';

// ⚡ DUPLICATION PROTECTION: Prevent duplicate processing
const processedMessages = new Set(); // In-memory cache for processed message IDs

const handleInteractiveButtons = async (message, from, phone_number_id) => {
    logger.info(`Handling interactive buttons - From: ${from}, PhoneID: ${phone_number_id}, Type: ${message.interactive.type}`);
    
    switch (message.interactive.type) {
        case 'button_reply':
            logger.debug(`Button reply received - ID: ${message.interactive.button_reply.id}, From: ${from}`);
            message.text = { "body": message.interactive.button_reply.id };
            break;
        case 'list_reply':
            logger.debug(`List reply received - Description: ${message.interactive.list_reply.description}, From: ${from}`);
            message.text = { "body": message.interactive.list_reply.description };
            break;
        case 'payment':
            logger.info(`Payment interaction received - Status: ${message.interactive.payment.status}, From: ${from}`);
            if (message.interactive.payment.status == 'success') {
                logger.info(`Payment successful - Reference: ${message.interactive.payment.reference_id}, From: ${from}`);
                sendWhatsAppOrderStatus('Payment Received', message.interactive.payment.reference_id, 'processing', 'Access requested for next 2 hours', from, phone_number_id);
            }
            return;
        default:
            logger.warn(`Unknown interactive type: ${message.interactive.type}, From: ${from}`);
            return;
    }

    logger.debug(`Proceeding to handle text message for interactive button - From: ${from}`);
    handleTextMessage(message, from, phone_number_id);
}

const handleTextMessage = async (message, from, phone_number_id) => {
    const startTime = Date.now();
    logger.info(`Handling text message - From: ${from}, PhoneID: ${phone_number_id}, Text: ${message.text.body?.substring(0, 100)}...`);

    let response = {
        answer: 'Please reply from one of the options. Reply \'Reset\' to change your answers in between the conversation.'
    }
    let options = {
        button: "Options",
        sections: [
            {
                title: "Financial Frauds",
                rows: [
                    {
                        "id": "ATM",
                        "title": "ATM Frauds",
                        "description": "Frauds using your ATM cards"
                    },
                    {
                        "id": "UPI",
                        "title": "UPI Fraud",
                        "description": "Frauds using your bank UPI account"
                    },
                    {
                        "id": "Failures",
                        "title": "Payment failures",
                        "description": "Issues related to payment failures"
                    },
                    {
                        "id": "ATM Failures",
                        "title": "ATM Transaction failed",
                        "description": "Cash not dispensed"
                    }
                ]
            },
            {
                title: "Employment",
                rows: [
                    {
                        "id": "Employment Termination",
                        "title": "Employee",
                        "description": "Employment Termination Issues"
                    },
                    {
                        "id": "Employment OfferLetter",
                        "title": "Offer Letter",
                        "description": "Analyze Employment Offer Letter"
                    },
                    {
                        "id": "Employment Payment",
                        "title": "Salary Issues",
                        "description": "Delay or Non Payments of Salary & Statutory Benefits"
                    }
                ]
            },
            {
                title: "Travel",
                rows: [
                    {
                        "id": "Flights",
                        "title": "Flights Grievances",
                        "description": "Issues while Traveling in Flight"
                    },
                    {
                        "id": "Trains",
                        "title": "Trains Grievances",
                        "description": "Issues while Traveling in Train"
                    }
                ]
            }
        ]
    }

    let session, threadId;
    if (message.text.body.toLowerCase() == 'exit') {
        logger.info(`Exit command received - From: ${from}`);
        session = await deleteSession(from);
        if (session && session.payment && session.payment.reference_id) {
            logger.info(`Sending completion status for payment - Reference: ${session.payment.reference_id}, From: ${from}`);
            sendWhatsAppOrderStatus('EqualJustice.ai', session.payment.reference_id, 'completed', 'Access removed', from, phone_number_id);
        }
        sendWatsAppWithList(response.answer, options, 'EqualJustice.ai', 'Reply \'Exit\' to start new case.', from, phone_number_id);
        return;
    }
    
    logger.debug(`Getting session for user - From: ${from}`);
    session = await getSession(from);
    
    if (!session) {
        logger.info(`No existing session found - Creating new session for: ${from}`);
        let DFResponse = await getActionFromDFES(message.text.body, from);
        logger.debug(`Dialogflow ES response received`, {
            from: from,
            fulfillmentText: DFResponse.fulfillmentText,
            hasPayload: !!DFResponse.payload,
            action: DFResponse.payload?.action,
            agentType: DFResponse.payload?.agentType
        });
        
        if (DFResponse.fulfillmentText) {
            logger.debug(`Sending fulfillment text - From: ${from}, Text: ${DFResponse.fulfillmentText}`);
            sendWatsAppText(DFResponse.fulfillmentText, from, phone_number_id);
        }
        
        if (DFResponse.payload && DFResponse.payload.action && DFResponse.payload.agentType) {
            if (DFResponse.payload.agentType == 'assistant') {
                logger.info(`Creating OpenAI assistant thread - From: ${from}`);
                threadId = await createAssistantThread(from);
            } else {
                logger.info(`Creating WhatsApp thread - From: ${from}`);
                threadId = 'whatsApp-' + from + '-' + await generateId(8);
            }
            
            session = {
                threadId: threadId,
                action: DFResponse.payload.action,
                agentType: DFResponse.payload.agentType,
                targetAgent: DFResponse.payload.targetAgent,
                pricing: DFResponse.payload.pricing,
                payment: { transaction: { status: 'pending' }, linkSent: false },
                interactions: 1
            }
            
            logger.info(`New session created`, {
                from: from,
                threadId: threadId,
                action: session.action,
                agentType: session.agentType
            });
            
            message.text = { "body": "hi" };
            saveSession(from, session.threadId, session.action, session.agentType, session.targetAgent, session.pricing, session.payment, session.interactions);
        } else if (DFResponse.payload && DFResponse.payload.action) {
            session = { action: DFResponse.payload.action };
        } else {
            logger.debug(`No specific action found, sending options menu - From: ${from}`);
            sendWatsAppWithList(response.answer, options, 'How can I help you Today?', 'EqualJustice.ai', from, phone_number_id);
            return;
        }
    }
    
    if (['restart', 'reset'].includes(message.text.body.toLowerCase())) {
        logger.info(`Restart/Reset command received - From: ${from}, Current agent type: ${session.agentType}`);
        
        if (session.agentType == 'assistant') {
            logger.info(`Creating new OpenAI assistant thread for restart - From: ${from}`);
            session.threadId = await createAssistantThread(from);
        } else {
            logger.info(`Creating new WhatsApp thread for restart - From: ${from}`);
            session.threadId = 'whatsApp-' + from + '-' + await generateId(8);
        }
        
        updateSessionWithNewThread(from, session.threadId);
        message.text = { "body": "hi" };
        logger.info(`Session restarted with new thread - From: ${from}, New thread: ${session.threadId}`);
    }
    
    switch (session.action) {
        case types.transaction.ATM:
        case types.transaction.UPI:
        case types.transaction.FAILED_TRANSACTION:
        case types.employee.Retrenchment:
        case types.travel.Flights:
            if((session && session.agentType)){
                logger.debug(`Getting CX response for action: ${session.action} - From: ${from}`);
                response = await getCXResponse(message.text.body, session.targetAgent, session.threadId, 'en');
                logger.debug(`CX response received - Length: ${response.answer?.length || 0}, From: ${from}`);
            } 
            else {
                logger.warn(`No agent type found for action: ${session.action} - From: ${from}`);
                response = {
                    answer: `Please send \'Exit\' to start again`
                }
            }
            break;
        case types.employee.Offer:
            if ((session && session.targetAgent)) {
                if(session.interactions <= 10 || session.payment.transaction.status == 'success' || phone_number_id == '359476970593209'){
                    logger.info(`Using OpenAI assistant - Interactions: ${session.interactions}, Payment status: ${session.payment.transaction.status} - From: ${from}`);
                    response = await interactWithAssistant(message.text.body, from, session.targetAgent.assistantId, session.threadId);
                    if (response.answer && response.answer != '') {
                        logger.debug(`Converting markdown to WhatsApp format - From: ${from}`);
                        response.answer = convertMarkdownToWhatsApp(response.answer);
                    }
                    session.interactions++;
                    saveSession(from, session.threadId, session.action, session.agentType, session.targetAgent, session.pricing, session.payment, session.interactions);
                    logger.debug(`Session updated - New interaction count: ${session.interactions} - From: ${from}`);
                }
                else if ((session.interactions > 10 && session.payment && session.payment.transaction.status == 'pending') || phone_number_id == '359476970593209') {
                    if (!session.payment.linkSent){
                        logger.info(`Sending payment request - Interactions: ${session.interactions} - From: ${from}`);
                        let reference_id = await generateId(8);
                        sendWhatsAppOrderForPayment("Please pay to proceed", session.pricing, reference_id, from, phone_number_id);
                        session.payment.linkSent = true;
                        session.interactions++;
                        saveSession(from, session.threadId, session.action, session.agentType, session.targetAgent, session.pricing, session.payment, session.interactions);
                        return;
                    } else {
                        logger.debug(`Payment link already sent - From: ${from}`);
                        response = {
                            answer: `Please complete the payment to proceed further. If you have successfully paid, please wait.`
                        };
                    }
                }
                else if (session.payment) {
                    logger.debug(`Payment pending - From: ${from}`);
                    response = {
                        answer: `Please complete payment to proceed further. If you have successfully paid, Please wait.`
                    }
                }             
            }
            else {
                logger.warn(`No target agent found for employment offer - From: ${from}`);
                response = {
                    answer: `Please send \'Exit\' to start again`
                }
            }
            break;
        case types.actions.Welcome:
            logger.debug(`Welcome action - From: ${from}`);
            sendWatsAppWithList(response.answer, options, 'EqualJustice.ai', 'Reply \'Exit\' to start new case.', from, phone_number_id);
            return;
        case types.actions.Fallback:
            logger.debug(`Fallback action - From: ${from}`);
            sendWatsAppWithList(response.answer, options, 'EqualJustice.ai', 'Reply \'Exit\' to start new case.', from, phone_number_id);
            return;
        default:
            logger.warn(`Unknown action: ${session.action} - From: ${from}`);
            response = {
                answer: `AI Training for this is under development, This service will be available soon.`
            }
    }
    
    const totalTime = Date.now() - startTime;
    logger.info(`Text message handling completed`, {
        from: from,
        action: session.action,
        responseTime: `${totalTime}ms`,
        responseLength: response.answer?.length || 0
    });
    
    sendAIResponse(session, response, message, from, phone_number_id);
};

const sendAIResponse = async (session, response, message, from, phone_number_id) => {
    logger.debug(`Sending AI response - From: ${from}, Response type: ${response.payload ? 'with payload' : 'text only'}`);
    
    if (response.payload && response.answer) {
        if (response.payload.pricing) {
            logger.info(`Sending payment request - From: ${from}`);
            let reference_id = await generateId(8);
            sendWhatsAppOrderForPayment(response.answer, response.payload.pricing, reference_id, from, phone_number_id);
            return;
        }
        
        let options = DFchipsToButtonOrList(response.payload);
        logger.debug(`Converted payload to options - Button: ${options.button}, Options count: ${Array.isArray(options) ? options.length : 'N/A'} - From: ${from}`);
        
        if (options.button) {
            logger.debug(`Sending list message - From: ${from}`);
            sendWatsAppWithList(response.answer, options, '', '', from, phone_number_id);
        } else if (Array.isArray(options) && options.length > 0 && options.filter(option => option.type === 'reply')) {
            logger.debug(`Sending button message - From: ${from}`);
            sendWatsAppWithButtons(response.answer, options, '', from, phone_number_id);
        } else if (options.name && options.name == 'cta_url') {
            logger.debug(`Sending file link - From: ${from}`);
            sendWatsAppText(response.answer, from, phone_number_id);
            const fileSent = await sendWhatsAppFileLink('Here is link to download your document', options, 'Download Draft', 'EqualJustice.ai', from, phone_number_id);
            if (fileSent) {
                logger.info(`File link sent successfully, getting CX event response - From: ${from}`);
                response = await getCXEventResponse('startQnA', session.targetAgent, session.threadId, 'en');
                sendAIResponse(session, response, message, from, phone_number_id);
            }
        } else {
            logger.debug(`Sending text message - From: ${from}`);
            sendWatsAppText(response.answer, from, phone_number_id);
        }
    } else if (response.answer && response.answer != '') {
        if (message) {
            logger.debug(`Sending reply message - From: ${from}`);
            sendWatsAppReplyText(response.answer, message.id, from, phone_number_id);
        } else {
            logger.debug(`Sending text message - From: ${from}`);
            sendWatsAppText(response.answer, from, phone_number_id);
        }
    }
    
    if (response.sessionEnd) {
        logger.info(`Session ending - From: ${from}`);
        session = await deleteSession(from);
        if (session && session.payment && session.payment.reference_id) {
            logger.info(`Sending completion status for ended session - Reference: ${session.payment.reference_id}, From: ${from}`);
            sendWhatsAppOrderStatus('EqualJustice.ai', session.payment.reference_id, 'completed', 'Access removed', from, phone_number_id);
        }
    }
}

const handleDocumentMessage = async (message, from, phone_number_id) => {
    const messageId = message.id;
    
    // ⚡ DUPLICATE CHECK: Prevent WhatsApp duplicate webhook processing
    if (processedMessages.has(messageId)) {
        logger.info(`Duplicate document message ignored: ${messageId} - From: ${from}`);
        return;
    }
    
    // ⚡ ADD TO PROCESSED SET: Track processing status
    processedMessages.add(messageId);
    
    try {
        // ⚡ IMMEDIATE ACKNOWLEDGMENT: User feedback
        logger.info(`Processing document message - MessageID: ${messageId}, From: ${from}`);
        sendWatsAppText('We have received your document, Please wait while we are processing it.', from, phone_number_id);
        
        // ⚡ ASYNC PROCESSING: Don't block webhook response
        processDocumentAsync(message, from, phone_number_id);
        
    } catch (error) {
        // ⚡ ERROR RECOVERY: Remove from processed set on error
        processedMessages.delete(messageId);
        logger.error('Error handling document message:', error);
        sendWatsAppText('Sorry, there was an error processing your document. Please try again.', from, phone_number_id);
    }
};

const processDocumentAsync = async (message, from, phone_number_id) => {
    try {
        logger.debug(`Starting async document processing - From: ${from}`);
        
        let media = await getWAMediaURL(message.document.id, phone_number_id);
        let filePath = await downloadWAFile(media.url, message.document.id + '_' + message.document.filename);
        
        logger.info(`Document downloaded - Path: ${filePath}, From: ${from}`);
        
        // Add progress updates
        sendWatsAppText('Document downloaded, now extracting text...', from, phone_number_id);
        
        let pdfContent = await extractTextFromDocument(filePath, media.mime_type);
        
        if (pdfContent) {
            logger.info(`Text extraction successful - Length: ${pdfContent.length}, From: ${from}`);
            message.text = { "body": pdfContent };
            await handleTextMessage(message, from, phone_number_id);
        } else {
            logger.warn(`Text extraction failed - From: ${from}`);
            sendWatsAppText('Could not extract text from your document. Please ensure it\'s a valid PDF or DOCX file.', from, phone_number_id);
        }
        
        // Clean up
        processedMessages.delete(message.id);
        await deleteFile(filePath);
        logger.info(`Document processing completed and cleaned up - From: ${from}`);
        
    } catch (error) {
        // ⚡ ERROR RECOVERY: Remove from processed set on error
        processedMessages.delete(message.id);
        logger.error('Error processing document:', error);
        sendWatsAppText('Document processing failed. Please try again with a different file.', from, phone_number_id);
    }
};

const AnalyzeMessage = async (req, res) => {
    try {
        let message = req.body.entry[0].changes[0].value.messages[0];
        let phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
        
        logger.info(`Analyzing message - Type: ${message.type}, From: ${message.from}, PhoneID: ${phone_number_id}`);
        
        markAsRead(message.id, phone_number_id);
        
        switch (message.type) {
            case 'text':
                logger.debug(`Processing text message - From: ${message.from}`);
                await handleTextMessage(message, message.from, phone_number_id);
                break;
            case 'document':
                logger.debug(`Processing document message - From: ${message.from}`);
                await handleDocumentMessage(message, message.from, phone_number_id);
                break;
            case 'interactive':
                logger.debug(`Processing interactive message - From: ${message.from}`);
                await handleInteractiveButtons(message, message.from, phone_number_id);
                break;
            case 'image':
            case 'audio':
                logger.debug(`Media message received (not processed) - Type: ${message.type}, From: ${message.from}`);
                break;
            case 'video':
                logger.debug(`Video message received - From: ${message.from}`);
                let media = await getWAMediaURL(message.video.id, phone_number_id);
                logger.info(`Video media info - From: ${message.from}`, { media: media });
                break;
            case 'reaction':
                logger.debug(`Reaction message received - From: ${message.from}`);
                break;
            default:
                logger.warn(`Unknown message type: ${message.type} - From: ${message.from}`);
                break;
        }

    } catch (error) {
        logger.error('Error analyzing message:', error);
    }
};

export const getWhatsAppMsg = async (req, res) => {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`WhatsApp webhook received - ID: ${webhookId}`, {
        body: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });
    
    // ⚡ WEBHOOK TIMEOUT PROTECTION: Prevent WhatsApp retries
    const webhookTimeout = setTimeout(() => {
        logger.error(`WhatsApp webhook timeout - ID: ${webhookId}, Sending 408 status`);
        res.sendStatus(408); // Request Timeout
    }, 19000); // 19 seconds (WhatsApp limit is 20s)
    
    try {
        if (isStatusMessage(req.body)) {
            logger.info(`Processing status message - Webhook ID: ${webhookId}`);
            let status = req.body.entry[0].changes[0].value.statuses[0];
            
            if (status.type == 'payment') {
                logger.info(`Payment status update - Recipient: ${status.recipient_id}, Status: ${status.status}, Webhook ID: ${webhookId}`);
                await updateSessionWithPayment(status.recipient_id, status.payment);
                
                if (status.status == 'captured') {
                    logger.info(`Payment captured - Processing payment status - Webhook ID: ${webhookId}`);
                    await handelPaymentStatus(req, res);
                }
                
                logger.info(`Payment status processed successfully - Webhook ID: ${webhookId}`);
            }
            
            clearTimeout(webhookTimeout);
            res.sendStatus(200);
            
        } else if (hasMessagesArray(req.body)) {
            logger.info(`Processing message array - Webhook ID: ${webhookId}, Message count: ${req.body.entry[0].changes[0].value.messages.length}`);
            
            // ⚡ ASYNC PROCESSING: Don't block webhook response
            await AnalyzeMessage(req, res);
            
            clearTimeout(webhookTimeout);
            res.sendStatus(200);
            logger.info(`Message array processed successfully - Webhook ID: ${webhookId}`);
            
        } else {
            logger.debug(`No actionable content in webhook - Webhook ID: ${webhookId}`);
            clearTimeout(webhookTimeout);
            res.sendStatus(200);
        }
        
    } catch (error) {
        // ⚡ ERROR HANDLING: Proper error responses
        clearTimeout(webhookTimeout);
        logger.error(`Webhook processing error - ID: ${webhookId}`, {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        res.sendStatus(500);
    }
};

const handelPaymentStatus = async (req, res) => {
    logger.info('Handling payment status update');
    
    let status = req.body.entry[0].changes[0].value.statuses[0];
    let phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;

    logger.info(`Payment status details`, {
        recipient: status.recipient_id,
        status: status.status,
        phoneId: phone_number_id
    });

    sendWhatsAppOrderStatus('Access allowed for next 2 hours, Say Hi to continue', status.payment.reference_id, 'completed', 'Payment Received', status.recipient_id, phone_number_id);

    let session = await getSession(status.recipient_id);
    if (session && session.agentType == 'CX') {
        logger.info(`Getting CX event response for payment captured - Recipient: ${status.recipient_id}`);
        let response = await getCXEventResponse('payment-captured', session.targetAgent, session.threadId, 'en');
        sendAIResponse(session, response, null, status.recipient_id, phone_number_id);
    } else {
        logger.info(`Creating welcome message for payment completion - Recipient: ${status.recipient_id}`);
        let message = { "text": { "body": 'Hi' } };
        handleTextMessage(message, status.recipient_id, phone_number_id);
    }
}

export const verifywhatsapp = async (req, res) => {
    logger.info('WhatsApp verification request received', {
        mode: req.query['hub.mode'],
        token: req.query['hub.verify_token'],
        challenge: req.query['hub.challenge']
    });
    
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === 'equaljusticeai') {
        logger.info('WhatsApp verification successful');
        res.send(req.query['hub.challenge']);
    } else {
        logger.warn('WhatsApp verification failed - Invalid parameters');
        res.sendStatus(403);
    }
}

function hasMessagesArray(data) {
    return data.entry && data.entry[0].changes && data.entry[0].changes[0].value && Array.isArray(data.entry[0].changes[0].value.messages);
}

function isStatusMessage(data) {
    return data.entry && data.entry[0].changes && data.entry[0].changes[0].value && Array.isArray(data.entry[0].changes[0].value.statuses);
}
