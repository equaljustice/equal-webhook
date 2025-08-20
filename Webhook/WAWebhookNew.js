import * as types from '../utils/types.js';
import { logger } from '../utils/logging.js';
import { extractTextFromDocument, deleteFile } from '../utils/readFileData.js';
import { markAsRead, sendWatsAppText, sendWatsAppReplyText, getWAMediaURL, downloadWAFile, sendWatsAppWithButtons, sendWatsAppWithList, sendWhatsAppFileLink, sendWatsAppVideo, sendWhatsAppOrderForPayment, sendWhatsAppOrderStatus, validateWhatsAppConfig } from '../whatsApp/whatsAppAPI.js';
import { interactWithAssistant, createAssistantThread } from "../chatGPT/helpers/assistant-api.js";
import { deleteSession, getSession, saveSession, updateSessionWithNewThread, updateSessionWithPayment } from '../Services/redis/redisWASession.js';
import { getActionFromDFES } from '../Services/Dialogflow/detectIntentES.js';
import { getCXEventResponse, getCXResponse } from '../Services/Dialogflow/detectIntentCX.js';
import { DFchipsToButtonOrList } from '../whatsApp/DFchipsToButtons.js';
import { convertMarkdownToWhatsApp } from '../whatsApp/markdownToWA.js';
import { generateId } from '../utils/generateID.js';
import paymentConfig from '../config/payment.js';

// Initialize payment configuration
paymentConfig.init();

// ⚡ DUPLICATION PROTECTION: Prevent duplicate processing
const processedMessages = new Set(); // In-memory cache for processed message IDs

// ⚡ TAT (Turnaround Time) tracking per webhook request
const tatStore = new Map();

function ensureTrace(webhookId) {
    let trace = tatStore.get(webhookId);
    if (!trace) {
        trace = { requestStart: Date.now(), steps: {}, summaryLogged: false };
        tatStore.set(webhookId, trace);
    }
    return trace;
}

function startStep(webhookId, stepName) {
    if (!webhookId) return;
    const trace = ensureTrace(webhookId);
    if (!trace.steps[stepName]) trace.steps[stepName] = { count: 0, totalMs: 0, _start: null };
    trace.steps[stepName]._start = Date.now();
}

function endStep(webhookId, stepName) {
    if (!webhookId) return;
    const trace = ensureTrace(webhookId);
    const step = trace.steps[stepName];
    if (!step || step._start == null) return;
    const duration = Date.now() - step._start;
    step.totalMs += duration;
    step.count += 1;
    step._start = null;
}

function logTatSummary(webhookId, context) {
    if (!webhookId) return;
    const trace = tatStore.get(webhookId);
    if (!trace || trace.summaryLogged) return;
    const totalMs = Date.now() - trace.requestStart;
    const steps = Object.entries(trace.steps).map(([name, data]) => ({ step: name, count: data.count, totalMs: data.totalMs }));
    
    // Add processing status to context
    const processingStatus = trace.steps['AnalyzeMessage'] ? 'completed' : 'background_processing';
    
    logger.info(`TAT summary - ID: ${webhookId}${context ? `, Context: ${context}` : ''}`, {
        totalMs: totalMs,
        processingStatus: processingStatus,
        steps: steps,
        backgroundProcessing: !trace.steps['AnalyzeMessage']
    });
    
    trace.summaryLogged = true;
    tatStore.delete(webhookId);
}

const handleInteractiveButtons = async (message, from, phone_number_id, webhookId) => {
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
                
                // Update session payment status for interactive payment
                try {
                    await updateSessionWithPayment(from, {
                        reference_id: message.interactive.payment.reference_id,
                        transaction: { status: 'success' },
                        interactive_payment: message.interactive.payment,
                        payment_method: 'interactive',
                        timestamp: new Date().toISOString()
                    });
                    logger.info(`Session payment status updated to success via interactive payment - From: ${from}`);
                } catch (paymentUpdateError) {
                    logger.error(`Failed to update session payment status via interactive payment - From: ${from}`, {
                        error: paymentUpdateError.message,
                        reference_id: message.interactive.payment.reference_id
                    });
                }
                
                const accessDurationText = paymentConfig.accessDurationHours === 1 ? '1 hour' : `${paymentConfig.accessDurationHours} hours`;
                sendWhatsAppOrderStatus(`Payment Received - Access granted for next ${accessDurationText}`, message.interactive.payment.reference_id, 'processing', 'Access requested', from, phone_number_id);
            }
            return;
        default:
            logger.warn(`Unknown interactive type: ${message.interactive.type}, From: ${from}`);
            return;
    }

    logger.debug(`Proceeding to handle text message for interactive button - From: ${from}`);
    handleTextMessage(message, from, phone_number_id, webhookId);
}

const handleTextMessage = async (message, from, phone_number_id, webhookId) => {
    const startTime = Date.now();
    logger.info(`Handling text message - From: ${from}, PhoneID: ${phone_number_id}, Text: ${message.text.body?.substring(0, 100)}...`);
    startStep(webhookId, 'handleTextMessage');
    
    try {
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
            try {
                session = await deleteSession(from);
                if (session && session.payment && session.payment.reference_id) {
                    logger.info(`Sending completion status for payment - Reference: ${session.payment.reference_id}, From: ${from}`);
                    sendWhatsAppOrderStatus('EqualJustice.ai', session.payment.reference_id, 'completed', 'Access removed', from, phone_number_id);
                }
                sendWatsAppWithList(response.answer, options, 'EqualJustice.ai', 'Reply \'Exit\' to start new case.', from, phone_number_id);
                logger.debug(`Exit options list sent - From: ${from}`, { options: options });
                logTatSummary(webhookId, 'exit');
                return;
            } catch (exitError) {
                logger.error(`Exit command processing failed - From: ${from}`, {
                    error: exitError.message,
                    stack: exitError.stack
                });
                throw exitError;
            }
        }
        
        logger.debug(`Getting session for user - From: ${from}`);
        startStep(webhookId, 'getSession');
        try {
            session = await getSession(from);
            logger.debug(`Session retrieved - From: ${from}`, { session: session });
        } catch (sessionError) {
            logger.error(`Failed to get session - From: ${from}`, {
                error: sessionError.message,
                stack: sessionError.stack
            });
            throw sessionError;
        }
        endStep(webhookId, 'getSession');
        
        if (!session) {
            logger.info(`No existing session found - Creating new session for: ${from}`);
            startStep(webhookId, 'getActionFromDFES');
            try {
                let DFResponse = await getActionFromDFES(message.text.body, from);
                logger.info(`Dialogflow ES response - From: ${from}`, { 
                    fulfillmentText: DFResponse.fulfillmentText,
                    hasPayload: !!DFResponse.payload,
                    action: DFResponse.payload?.action,
                    agentType: DFResponse.payload?.agentType,
                    targetAgent: DFResponse.payload?.targetAgent,
                    pricing: DFResponse.payload?.pricing
                });
                endStep(webhookId, 'getActionFromDFES');
                
                if (DFResponse.fulfillmentText) {
                    logger.debug(`Sending fulfillment text - From: ${from}, Text: ${DFResponse.fulfillmentText}`);
                    try {
                        logger.debug(`About to call sendWatsAppText - From: ${from}`);
                        sendWatsAppText(DFResponse.fulfillmentText, from, phone_number_id);
                        logger.debug(`Fulfillment text sent - From: ${from}`, { text: DFResponse.fulfillmentText });
                    } catch (fulfillmentError) {
                        logger.error(`Failed to send fulfillment text - From: ${from}`, {
                            error: fulfillmentError.message,
                            stack: fulfillmentError.stack
                        });
                    }
                }
                
                if (DFResponse.payload && DFResponse.payload.action && DFResponse.payload.agentType) {
                    if (DFResponse.payload.agentType == 'assistant') {
                        logger.info(`Creating OpenAI assistant thread - From: ${from}`);
                        startStep(webhookId, 'createAssistantThread');
                        try {
                            threadId = await createAssistantThread(from);
                            logger.info(`OpenAI assistant thread created successfully`, {
                                from: from,
                                threadId: threadId,
                                threadType: 'openai_assistant',
                                timestamp: new Date().toISOString()
                            });
                        } catch (threadError) {
                            logger.error(`Failed to create OpenAI assistant thread - From: ${from}`, {
                                error: threadError.message,
                                stack: threadError.stack
                            });
                            throw threadError;
                        }
                        endStep(webhookId, 'createAssistantThread');
                    } else {
                        logger.info(`Creating WhatsApp thread - From: ${from}`);
                        const generatedId = await generateId(8);
                        threadId = 'whatsApp-' + from + '-' + generatedId;
                        logger.info(`WhatsApp thread created successfully`, {
                            from: from,
                            threadId: threadId,
                            threadType: 'whatsApp',
                            generatedId: generatedId,
                            timestamp: new Date().toISOString()
                        });
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
                    startStep(webhookId, 'saveSession');
                    try {
                        saveSession(from, session.threadId, session.action, session.agentType, session.targetAgent, session.pricing, session.payment, session.interactions);
                        endStep(webhookId, 'saveSession');
                    } catch (saveError) {
                        logger.error(`Failed to save session - From: ${from}`, {
                            error: saveError.message,
                            stack: saveError.stack
                        });
                        throw saveError;
                    }
                } else if (DFResponse.payload && DFResponse.payload.action) {
                    session = { action: DFResponse.payload.action };
                } else {
                    logger.debug(`No specific action found, sending options menu - From: ${from}`);
                    try {
                        sendWatsAppWithList(response.answer, options, 'How can I help you Today?', 'EqualJustice.ai', from, phone_number_id);
                        logger.debug(`Options menu sent - From: ${from}`, { options: options });
                        logTatSummary(webhookId, 'no_specific_action');
                        return;
                    } catch (optionsError) {
                        logger.error(`Failed to send options menu - From: ${from}`, {
                            error: optionsError.message,
                            stack: optionsError.stack
                        });
                        throw optionsError;
                    }
                }
            } catch (dfError) {
                logger.error(`Dialogflow processing failed - From: ${from}`, {
                    error: dfError.message,
                    stack: dfError.stack
                });
                throw dfError;
            }
        }
        
        if (['restart', 'reset'].includes(message.text.body.toLowerCase())) {
            logger.info(`Restart/Reset command received - From: ${from}, Current agent type: ${session.agentType}`);
            
            if (session.agentType == 'assistant') {
                logger.info(`Creating new OpenAI assistant thread for restart - From: ${from}`);
                startStep(webhookId, 'createAssistantThread');
                try {
                    session.threadId = await createAssistantThread(from);
                    logger.info(`OpenAI assistant thread created for restart successfully`, {
                        from: from,
                        threadId: session.threadId,
                        threadType: 'openai_assistant_restart',
                        previousThreadId: session.threadId,
                        timestamp: new Date().toISOString()
                    });
                } catch (restartError) {
                    logger.error(`Failed to create restart thread - From: ${from}`, {
                        error: restartError.message,
                        stack: restartError.stack
                    });
                    throw restartError;
                }
                endStep(webhookId, 'createAssistantThread');
            } else {
                logger.info(`Creating new WhatsApp thread for restart - From: ${from}`);
                const generatedId = await generateId(8);
                const previousThreadId = session.threadId;
                session.threadId = 'whatsApp-' + from + '-' + generatedId;
                logger.info(`WhatsApp thread created for restart successfully`, {
                    from: from,
                    threadId: session.threadId,
                    threadType: 'whatsApp_restart',
                    previousThreadId: previousThreadId,
                    generatedId: generatedId,
                    timestamp: new Date().toISOString()
                });
            }
            
            startStep(webhookId, 'updateSessionWithNewThread');
            try {
                updateSessionWithNewThread(from, session.threadId);
                endStep(webhookId, 'updateSessionWithNewThread');
            } catch (updateError) {
                logger.error(`Failed to update session with new thread - From: ${from}`, {
                    error: updateError.message,
                    stack: updateError.stack
                });
                throw updateError;
            }
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
                    startStep(webhookId, 'getCXResponse');
                    try {
                        response = await getCXResponse(message.text.body, session.targetAgent, session.threadId, 'en');
                        logger.info(`CX response received - From: ${from}`, { 
                            action: session.action,
                            responseLength: response.answer?.length || 0,
                            hasPayload: !!response.payload,
                            sessionEnd: response.sessionEnd
                        });
                        endStep(webhookId, 'getCXResponse');
                    } catch (cxError) {
                        logger.error(`CX response failed - From: ${from}`, {
                            error: cxError.message,
                            stack: cxError.stack,
                            action: session.action
                        });
                        throw cxError;
                    }
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
                    if(paymentConfig.hasFreeInteractionsRemaining(session, phone_number_id) || paymentConfig.hasValidPayment(session, phone_number_id)){
                        logger.info(`Using OpenAI assistant - Interactions: ${session.interactions}, Payment status: ${session.payment?.transaction?.status || 'none'}, Free interactions remaining: ${paymentConfig.getRemainingFreeInteractions(session, phone_number_id)} - From: ${from}`);
                        startStep(webhookId, 'interactWithAssistant');
                        try {
                            response = await interactWithAssistant(message.text.body, from, session.targetAgent.assistantId, session.threadId);
                            logger.info(`OpenAI assistant response - From: ${from}`, { 
                                interactions: session.interactions,
                                responseLength: response.answer?.length || 0,
                                hasPayload: !!response.payload,
                                sessionEnd: response.sessionEnd
                            });
                            endStep(webhookId, 'interactWithAssistant');
                        } catch (assistantError) {
                            logger.error(`OpenAI assistant failed - From: ${from}`, {
                                error: assistantError.message,
                                stack: assistantError.stack
                            });
                            throw assistantError;
                        }
                        
                        if (response.answer && response.answer != '') {
                            logger.debug(`Converting markdown to WhatsApp format - From: ${from}`);
                            startStep(webhookId, 'convertMarkdownToWhatsApp');
                            try {
                                response.answer = convertMarkdownToWhatsApp(response.answer);
                                logger.debug(`Markdown converted to WhatsApp format - From: ${from}`, { 
                                    originalLength: response.answer?.length || 0,
                                    convertedLength: response.answer?.length || 0
                                });
                                endStep(webhookId, 'convertMarkdownToWhatsApp');
                            } catch (markdownError) {
                                logger.error(`Markdown conversion failed - From: ${from}`, {
                                    error: markdownError.message,
                                    stack: markdownError.stack
                                });
                                // Continue without conversion
                            }
                        }
                        session.interactions++;
                        startStep(webhookId, 'saveSession');
                        try {
                            saveSession(from, session.threadId, session.action, session.agentType, session.targetAgent, session.pricing, session.payment, session.interactions);
                            endStep(webhookId, 'saveSession');
                            logger.debug(`Session updated - New interaction count: ${session.interactions} - From: ${from}`);
                        } catch (saveError) {
                            logger.error(`Failed to save session after assistant - From: ${from}`, {
                                error: saveError.message,
                                stack: saveError.stack
                            });
                            // Continue without saving
                        }
                    }
                    else if (paymentConfig.isPaymentRequiredButNotSent(session, phone_number_id)) {
                        logger.info(`Sending payment request - Interactions: ${session.interactions}, Free interactions: ${paymentConfig.freeInteractions} - From: ${from}`);
                        let reference_id = await generateId(8);
                        try {
                            sendWhatsAppOrderForPayment("Please pay to proceed", session.pricing, reference_id, from, phone_number_id);
                            logger.info(`Payment request sent - From: ${from}`, { 
                                referenceId: reference_id,
                                pricing: session.pricing,
                                interactions: session.interactions
                            });
                            session.payment.linkSent = true;
                            session.interactions++;
                            saveSession(from, session.threadId, session.action, session.agentType, session.targetAgent, session.pricing, session.payment, session.interactions);
                            logTatSummary(webhookId, 'payment_link_sent');
                            return;
                        } catch (paymentError) {
                            logger.error(`Failed to send payment request - From: ${from}`, {
                                error: paymentError.message,
                                stack: paymentError.stack
                            });
                            throw paymentError;
                        }
                    }
                    else if (paymentConfig.isPaymentLinkAlreadySent(session, phone_number_id)) {
                        logger.debug(`Payment link already sent - From: ${from}`);
                        response = {
                            answer: `Please complete the payment to proceed further. If you have successfully paid, please wait.`
                        };
                    }
                    else if (paymentConfig.isPaymentPending(session, phone_number_id)) {
                        logger.debug(`Payment pending - From: ${from}`);
                        response = {
                            answer: `Please complete payment to proceed further. If you have successfully paid, Please wait.`
                        };
                    }             
                }
                else {
                    logger.warn(`No target agent found for employment offer - From: ${from}`);
                    response = {
                        answer: `Please send \'Exit\' to start again`
                    };
                }
                break;
            case types.actions.Welcome:
                logger.debug(`Welcome action - From: ${from}`);
                try {
                    sendWatsAppWithList(response.answer, options, 'EqualJustice.ai', 'Reply \'Exit\' to start new case.', from, phone_number_id);
                    logger.debug(`Welcome options sent - From: ${from}`, { options: options });
                    logTatSummary(webhookId, 'welcome');
                    return;
                } catch (welcomeError) {
                    logger.error(`Failed to send welcome options - From: ${from}`, {
                        error: welcomeError.message,
                        stack: welcomeError.stack
                    });
                    throw welcomeError;
                }
            case types.actions.Fallback:
                logger.debug(`Fallback action - From: ${from}`);
                try {
                    sendWatsAppWithList(response.answer, options, 'EqualJustice.ai', 'Reply \'Exit\' to start new case.', from, phone_number_id);
                    logger.debug(`Fallback options sent - From: ${from}`, { options: options });
                    logTatSummary(webhookId, 'fallback');
                    return;
                } catch (fallbackError) {
                    logger.error(`Failed to send fallback options - From: ${from}`, {
                        error: fallbackError.message,
                        stack: fallbackError.stack
                    });
                    throw fallbackError;
                }
            default:
                logger.warn(`Unknown action: ${session.action} - From: ${from}`);
                response = {
                    answer: `AI Training for this is under development, This service will be available soon.`
                };
                // Send a basic response even for unknown actions
                try {
                    sendWatsAppText(response.answer, from, phone_number_id);
                    logger.debug(`Basic response sent for unknown action - From: ${from}`, { 
                        action: session.action,
                        answer: response.answer 
                    });
                    logTatSummary(webhookId, 'unknown_action');
                    return;
                } catch (basicError) {
                    logger.error(`Failed to send basic response - From: ${from}`, {
                        error: basicError.message,
                        stack: basicError.stack
                    });
                    throw basicError;
                }
        }
        
        const totalTime = Date.now() - startTime;
        logger.info(`Text message handling completed`, {
            from: from,
            action: session.action,
            responseTime: `${totalTime}ms`,
            responseLength: response.answer?.length || 0
        });
        endStep(webhookId, 'handleTextMessage');
        
        // If we reach here and no response was sent, send a basic response
        if (!response.answer || response.answer === 'Please reply from one of the options. Reply \'Reset\' to change your answers in between the conversation.') {
            logger.info(`No specific response generated, sending basic response - From: ${from}`);
            try {
                logger.debug(`About to call sendWatsAppText for basic response - From: ${from}`);
                sendWatsAppText('Hello! How can I help you today? Please choose from the options above or type "Exit" to start over.', from, phone_number_id);
                logger.debug(`Basic response sent - From: ${from}`);
                logTatSummary(webhookId, 'basic_response');
                return;
            } catch (basicError) {
                logger.error(`Failed to send basic response - From: ${from}`, {
                    error: basicError.message,
                    stack: basicError.stack
                });
                throw basicError;
            }
        }
        
        try {
            await sendAIResponse(session, response, message, from, phone_number_id, webhookId);
            logger.info(`AI response sent successfully - From: ${from}`);
        } catch (aiResponseError) {
            logger.error(`Failed to send AI response - From: ${from}`, {
                error: aiResponseError.message,
                stack: aiResponseError.stack
            });
            throw aiResponseError;
        }
        
    } catch (error) {
        logger.error(`Critical error in handleTextMessage - From: ${from}`, {
            error: error.message,
            stack: error.stack,
            message: message.text?.body
        });
        // Ensure we end the step even on error
        endStep(webhookId, 'handleTextMessage');
        throw error; // Re-throw to be caught by caller
    }
};

const sendAIResponse = async (session, response, message, from, phone_number_id, webhookId) => {
    logger.debug(`Sending AI response - From: ${from}, Response type: ${response.payload ? 'with payload' : 'text only'}`);
    startStep(webhookId, 'sendAIResponse');
    
    if (response.payload && response.answer) {
        if (response.payload.pricing) {
            logger.info(`Sending payment request - From: ${from}`);
            let reference_id = await generateId(8);
            sendWhatsAppOrderForPayment(response.answer, response.payload.pricing, reference_id, from, phone_number_id);
            logger.info(`Payment request sent from payload - From: ${from}`, { 
                referenceId: reference_id,
                pricing: response.payload.pricing,
                answer: response.answer
            });
            endStep(webhookId, 'sendAIResponse');
            logTatSummary(webhookId, 'pricing');
            return;
        }
        
        startStep(webhookId, 'DFchipsToButtonOrList');
        let options = DFchipsToButtonOrList(response.payload);
        logger.debug(`Payload converted to options - From: ${from}`, { 
            hasButton: !!options.button,
            optionsCount: Array.isArray(options) ? options.length : 'N/A',
            optionsType: options.name || 'standard'
        });
        endStep(webhookId, 'DFchipsToButtonOrList');
        logger.debug(`Converted payload to options - Button: ${options.button}, Options count: ${Array.isArray(options) ? options.length : 'N/A'} - From: ${from}`);
        
        if (options.button) {
            logger.debug(`Sending list message - From: ${from}`);
            sendWatsAppWithList(response.answer, options, '', '', from, phone_number_id);
            logger.debug(`List message sent - From: ${from}`, { 
                hasButton: options.button,
                optionsCount: Array.isArray(options) ? options.length : 'N/A'
            });
        } else if (Array.isArray(options) && options.length > 0 && options.filter(option => option.type === 'reply')) {
            logger.debug(`Sending button message - From: ${from}`);
            sendWatsAppWithButtons(response.answer, options, '', from, phone_number_id);
            logger.debug(`Button message sent - From: ${from}`, { 
                optionsCount: options.length,
                optionTypes: options.map(opt => opt.type)
            });
        } else if (options.name && options.name == 'cta_url') {
            logger.debug(`Sending file link - From: ${from}`);
            
            try {
                // Send introductory text first
                await sendWatsAppText(response.answer, from, phone_number_id);
                logger.debug(`File link text sent - From: ${from}`, { 
                    answer: response.answer,
                    optionsName: options.name
                });
            } catch (textError) {
                logger.warn(`Failed to send file link text - From: ${from}`, { 
                    error: textError.message
                });
                // Continue with file link even if text fails
            }
            
            try {
                const fileSent = await sendWhatsAppFileLink('Here is link to download your document', options, 'Download Draft', 'EqualJustice.ai', from, phone_number_id);
                logger.info(`File link process completed - From: ${from}`, { 
                    fileSent: fileSent,
                    optionsName: options.name
                });
                
                if (fileSent) {
                    logger.info(`File link sent successfully, getting CX event response - From: ${from}`);
                    try {
                        startStep(webhookId, 'getCXEventResponse');
                        response = await getCXEventResponse('startQnA', session.targetAgent, session.threadId, 'en');
                        logger.info(`CX event response for file link - From: ${from}`, { 
                            event: 'startQnA',
                            responseLength: response.answer?.length || 0,
                            hasPayload: !!response.payload
                        });
                        endStep(webhookId, 'getCXEventResponse');
                        sendAIResponse(session, response, message, from, phone_number_id, webhookId);
                    } catch (cxError) {
                        logger.error(`Failed to get CX event response after file link - From: ${from}`, {
                            error: cxError.message,
                            stack: cxError.stack
                        });
                        endStep(webhookId, 'getCXEventResponse');
                        // Don't continue with further AI response if CX fails
                    }
                } else {
                    logger.warn(`File link was not sent successfully - From: ${from}. User has been notified of the issue.`);
                    // File link function already handled fallback messaging
                }
                
            } catch (fileLinkError) {
                logger.error(`Critical error in file link process - From: ${from}`, {
                    error: fileLinkError.message,
                    stack: fileLinkError.stack,
                    options: options
                });
                
                // ⚡ EMERGENCY FALLBACK: Ensure user gets some response
                try {
                    await sendWatsAppText("We're experiencing technical difficulties with file delivery. Our team will send your document directly via email shortly.", from, phone_number_id);
                } catch (emergencyError) {
                    logger.error(`Emergency fallback message also failed - From: ${from}`, {
                        error: emergencyError.message
                    });
                }
            }
        } else {
            logger.debug(`Sending text message - From: ${from}`);
            sendWatsAppText(response.answer, from, phone_number_id);
            logger.debug(`Text message sent - From: ${from}`, { 
                answer: response.answer,
                answerLength: response.answer?.length || 0
            });
        }
    } else if (response.answer && response.answer != '') {
        if (message) {
            logger.debug(`Sending reply message - From: ${from}`);
            sendWatsAppReplyText(response.answer, message.id, from, phone_number_id);
            logger.debug(`Reply message sent - From: ${from}`, { 
                messageId: message.id,
                answer: response.answer,
                answerLength: response.answer?.length || 0
            });
        } else {
            logger.debug(`Sending text message - From: ${from}`);
            sendWatsAppText(response.answer, from, phone_number_id);
            logger.debug(`Text message sent - From: ${from}`, { 
                answer: response.answer,
                answerLength: response.answer?.length || 0
            });
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
    endStep(webhookId, 'sendAIResponse');
    logTatSummary(webhookId, 'message_flow_end');
}

const handleDocumentMessage = async (message, from, phone_number_id, webhookId) => {
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
        logger.debug(`Document acknowledgment sent - From: ${from}`, { messageId: messageId });
        
        // ⚡ ASYNC PROCESSING: Don't block webhook response
        processDocumentAsync(message, from, phone_number_id, webhookId);
        
    } catch (error) {
        // ⚡ ERROR RECOVERY: Remove from processed set on error
        processedMessages.delete(messageId);
        logger.error('Error handling document message:', error);
        sendWatsAppText('Sorry, there was an error processing your document. Please try again.', from, phone_number_id);
    }
};

const processDocumentAsync = async (message, from, phone_number_id, webhookId) => {
    try {
        logger.debug(`Starting async document processing - From: ${from}`);
        
        startStep(webhookId, 'getWAMediaURL');
        let media = await getWAMediaURL(message.document.id, phone_number_id);
        logger.info(`WhatsApp media URL retrieved - From: ${from}`, { 
            mediaId: message.document.id,
            mimeType: media.mime_type,
            hasUrl: !!media.url
        });
        endStep(webhookId, 'getWAMediaURL');
        startStep(webhookId, 'downloadWAFile');
        let filePath = await downloadWAFile(media.url, message.document.id + '_' + message.document.filename);
        logger.info(`File downloaded - From: ${from}`, { 
            filePath: filePath,
            filename: message.document.filename,
            mediaId: message.document.id
        });
        endStep(webhookId, 'downloadWAFile');
        
        logger.info(`Document downloaded - Path: ${filePath}, From: ${from}`);
        
        // Add progress updates
        sendWatsAppText('Document downloaded, now extracting text...', from, phone_number_id);
        logger.debug(`Document progress update sent - From: ${from}`, { filePath: filePath });
        
        startStep(webhookId, 'extractTextFromDocument');
        let pdfContent = await extractTextFromDocument(filePath, media.mime_type);
        logger.info(`Text extraction completed - From: ${from}`, { 
            extractedLength: pdfContent?.length || 0,
            mimeType: media.mime_type,
            success: !!pdfContent
        });
        endStep(webhookId, 'extractTextFromDocument');
        
        if (pdfContent) {
            logger.info(`Text extraction successful - Length: ${pdfContent.length}, From: ${from}`);
            message.text = { "body": pdfContent };
            logger.debug(`Document text converted to message - From: ${from}`, { 
                extractedLength: pdfContent.length,
                messageType: 'text'
            });
            await handleTextMessage(message, from, phone_number_id, webhookId);
        } else {
            logger.warn(`Text extraction failed - From: ${from}`);
            sendWatsAppText('Could not extract text from your document. Please ensure it\'s a valid PDF or DOCX file.', from, phone_number_id);
            logger.debug(`Document extraction failure message sent - From: ${from}`);
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

const AnalyzeMessage = async (req, res, webhookId) => {
    try {
        let message = req.body.entry[0].changes[0].value.messages[0];
        let phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
        
        logger.info(`Analyzing message - Type: ${message.type}, From: ${message.from}, PhoneID: ${phone_number_id}`);
        startStep(webhookId, 'AnalyzeMessage');
        
        try {
            markAsRead(message.id, phone_number_id);
            logger.debug(`Message marked as read - From: ${message.from}`, { messageId: message.id });
        } catch (markError) {
            logger.warn(`Failed to mark message as read - From: ${message.from}`, { 
                error: markError.message,
                messageId: message.id 
            });
        }
        
        switch (message.type) {
            case 'text':
                logger.debug(`Processing text message - From: ${message.from}`);
                try {
                    await handleTextMessage(message, message.from, phone_number_id, webhookId);
                    logger.info(`Text message processing completed successfully - From: ${message.from}`);
                } catch (textError) {
                    logger.error(`Text message processing failed - From: ${message.from}`, {
                        error: textError.message,
                        stack: textError.stack
                    });
                    throw textError; // Re-throw to be caught by outer catch
                }
                break;
            case 'document':
                logger.debug(`Processing document message - From: ${message.from}`);
                try {
                    await handleDocumentMessage(message, message.from, phone_number_id, webhookId);
                    logger.info(`Document message processing completed successfully - From: ${message.from}`);
                } catch (docError) {
                    logger.error(`Document message processing failed - From: ${message.from}`, {
                        error: docError.message,
                        stack: docError.stack
                    });
                    throw docError;
                }
                break;
            case 'interactive':
                logger.debug(`Processing interactive message - From: ${message.from}`);
                try {
                    await handleInteractiveButtons(message, message.from, phone_number_id, webhookId);
                    logger.info(`Interactive message processing completed successfully - From: ${message.from}`);
                } catch (interactiveError) {
                    logger.error(`Interactive message processing failed - From: ${message.from}`, {
                        error: interactiveError.message,
                        stack: interactiveError.stack
                    });
                    throw interactiveError;
                }
                break;
            case 'image':
            case 'audio':
                logger.debug(`Media message received (not processed) - Type: ${message.type}, From: ${message.from}`);
                logger.debug(`Unprocessed media message details - From: ${message.from}`, { 
                    messageType: message.type,
                    messageId: message.id
                });
                break;
            case 'video':
                logger.debug(`Video message received - From: ${message.from}`);
                try {
                    let media = await getWAMediaURL(message.video.id, phone_number_id);
                    logger.info(`Video media info - From: ${message.from}`, { media: media });
                    logger.debug(`Video message processed - From: ${message.from}`, { 
                        videoId: message.video.id,
                        mediaInfo: media
                    });
                } catch (videoError) {
                    logger.error(`Video message processing failed - From: ${message.from}`, {
                        error: videoError.message,
                        stack: videoError.stack
                    });
                }
                break;
            case 'reaction':
                logger.debug(`Reaction message received - From: ${message.from}`);
                logger.debug(`Reaction message details - From: ${message.from}`, { 
                    messageId: message.id,
                    reactionType: message.reaction?.type
                });
                break;
            default:
                logger.warn(`Unknown message type: ${message.type} - From: ${message.from}`);
                logger.debug(`Unknown message type details - From: ${message.from}`, { 
                    messageType: message.type,
                    messageId: message.id,
                    messageBody: message
                });
                break;
        }
        
        endStep(webhookId, 'AnalyzeMessage');
        logger.info(`Message analysis completed successfully - Type: ${message.type}, From: ${message.from}`);
        
    } catch (error) {
        logger.error(`Critical error in AnalyzeMessage - Webhook ID: ${webhookId}`, {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        // Ensure we end the step even on error
        endStep(webhookId, 'AnalyzeMessage');
        throw error; // Re-throw to be caught by the caller
    }
};

export const getWhatsAppMsg = async (req, res) => {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`WhatsApp webhook received - ID: ${webhookId}`, {
        body: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });
    ensureTrace(webhookId);
    startStep(webhookId, 'getWhatsAppMsg');
    
    // ⚡ PRE-FLIGHT CHECK: Validate WhatsApp configuration before processing
    const configValidation = validateWhatsAppConfig();
    if (!configValidation.valid) {
        logger.error(`WhatsApp configuration invalid - Webhook ID: ${webhookId}`, {
            errors: configValidation.errors,
            webhookId
        });
        res.status(503).json({ 
            error: 'Service temporarily unavailable', 
            details: 'WhatsApp API configuration issues',
            webhookId 
        });
        logTatSummary(webhookId, 'config_error');
        return;
    }
    
    // ⚡ WEBHOOK TIMEOUT PROTECTION: Prevent WhatsApp retries
    const webhookTimeout = setTimeout(() => {
        logger.error(`WhatsApp webhook timeout - ID: ${webhookId}, Sending 408 status`);
        try { res.sendStatus(408); } catch (_) {}
        logTatSummary(webhookId, 'timeout_408');
    }, 19000); // 19 seconds (WhatsApp limit is 20s)
    
    try {
        if (isStatusMessage(req.body)) {
            logger.info(`Processing status message - Webhook ID: ${webhookId}`);
            let status = req.body.entry[0].changes[0].value.statuses[0];
            
            if (status.type == 'payment') {
                logger.info(`Payment status update - Recipient: ${status.recipient_id}, Status: ${status.status}, Webhook ID: ${webhookId}`);
                
                // Only update session when payment is actually successful
                if (status.status == 'captured') {
                    logger.info(`Payment captured - Processing payment status - Webhook ID: ${webhookId}`);
                    startStep(webhookId, 'updateSessionWithPayment');
                    
                    // Update session with success status
                    try {
                        await updateSessionWithPayment(status.recipient_id, {
                            reference_id: status.payment.reference_id,
                            transaction: { status: 'success' },
                            webhook_payment: status.payment,
                            webhook_status: status.status,
                            capture_timestamp: new Date().toISOString()
                        });
                        logger.info(`Session payment status updated to success - Recipient: ${status.recipient_id}`);
                    } catch (updateError) {
                        logger.error(`Failed to update session payment status - Recipient: ${status.recipient_id}`, {
                            error: updateError.message,
                            payment: status.payment
                        });
                    }
                    
                    endStep(webhookId, 'updateSessionWithPayment');
                    await handelPaymentStatus(req, res, webhookId);
                } else {
                    logger.info(`Payment status '${status.status}' - no session update needed - Webhook ID: ${webhookId}`);
                }
                
                logger.info(`Payment status processed successfully - Webhook ID: ${webhookId}`);
            }
            
            clearTimeout(webhookTimeout);
            res.sendStatus(200);
            endStep(webhookId, 'getWhatsAppMsg');
            logTatSummary(webhookId, 'status');
            
        } else if (hasMessagesArray(req.body)) {
            logger.info(`Processing message array - Webhook ID: ${webhookId}, Message count: ${req.body.entry[0].changes[0].value.messages.length}`);
            
            // ⚡ ASYNC PROCESSING: Don't block webhook response
            // Remove await to make processing truly asynchronous
            AnalyzeMessage(req, res, webhookId)
                .then(() => {
                    logger.info(`Background message processing completed successfully - Webhook ID: ${webhookId}`);
                    // Ensure TAT summary is logged when processing completes
                    logTatSummary(webhookId, 'background_completed');
                })
                .catch(error => {
                    logger.error(`Background message processing error - Webhook ID: ${webhookId}`, {
                        error: error.message,
                        stack: error.stack,
                        body: req.body
                    });
                    // Ensure TAT summary is logged even on error
                    logTatSummary(webhookId, 'background_error');
                });
            
            // Add safety timeout to log TAT summary if not logged within 30 seconds
            setTimeout(() => {
                const trace = tatStore.get(webhookId);
                if (trace && !trace.summaryLogged) {
                    logger.warn(`Background processing safety timeout - Webhook ID: ${webhookId}`, {
                        hasAnalyzeMessage: !!trace.steps['AnalyzeMessage'],
                        steps: Object.keys(trace.steps),
                        totalMs: Date.now() - trace.requestStart
                    });
                    logTatSummary(webhookId, 'background_timeout_safety');
                }
            }, 30000);
            
            // Respond immediately to prevent timeout
            clearTimeout(webhookTimeout);
            res.sendStatus(200);
            logger.info(`Webhook response sent immediately - Processing continues in background - Webhook ID: ${webhookId}`);
            
        } else {
            logger.debug(`No actionable content in webhook - Webhook ID: ${webhookId}`);
            clearTimeout(webhookTimeout);
            res.sendStatus(200);
            endStep(webhookId, 'getWhatsAppMsg');
            logTatSummary(webhookId, 'no_action');
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
        endStep(webhookId, 'getWhatsAppMsg');
        logTatSummary(webhookId, 'error');
    }
};

const handelPaymentStatus = async (req, res, webhookId) => {
    logger.info('Handling payment status update');
    
    let status = req.body.entry[0].changes[0].value.statuses[0];
    let phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;

    logger.info(`Payment status details`, {
        recipient: status.recipient_id,
        status: status.status,
        phoneId: phone_number_id
    });

    const accessDurationText = paymentConfig.accessDurationHours === 1 ? '1 hour' : `${paymentConfig.accessDurationHours} hours`;
    sendWhatsAppOrderStatus(`Access allowed for next ${accessDurationText}, Say Hi to continue`, status.payment.reference_id, 'completed', 'Payment Received', status.recipient_id, phone_number_id);
    logger.info(`Payment completion status sent - Recipient: ${status.recipient_id}`, { 
        referenceId: status.payment.reference_id,
        status: 'completed'
    });

    let session = await getSession(status.recipient_id);
    logger.info(`Retrieved session for payment completion - Recipient: ${status.recipient_id}`, {
        hasSession: !!session,
        agentType: session?.agentType,
        paymentStatus: session?.payment?.transaction?.status,
        interactions: session?.interactions
    });
    if (session && session.agentType == 'CX') {
        logger.info(`Getting CX event response for payment captured - Recipient: ${status.recipient_id}`);
        startStep(webhookId, 'getCXEventResponse');
        let response = await getCXEventResponse('payment-captured', session.targetAgent, session.threadId, 'en');
        logger.info(`CX event response for payment captured - Recipient: ${status.recipient_id}`, { 
            event: 'payment-captured',
            responseLength: response.answer?.length || 0,
            hasPayload: !!response.payload
        });
        endStep(webhookId, 'getCXEventResponse');
        sendAIResponse(session, response, null, status.recipient_id, phone_number_id, webhookId);
    } else {
        logger.info(`Creating welcome message for payment completion - Recipient: ${status.recipient_id}`);
        let message = { "text": { "body": 'Hi' } };
        handleTextMessage(message, status.recipient_id, phone_number_id, webhookId);
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
