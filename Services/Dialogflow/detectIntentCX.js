import { SessionsClient } from '@google-cloud/dialogflow-cx';
import { convertProtobufToJson } from '../../utils/protoJson.js';
import { logger } from '../../utils/logging.js';

// ⚡ DEBUGGING: Simple error output for debugging
function debugError(error, context) {
  console.error('=== DIALOGFLOW ERROR DEBUG ===');
  console.error('Context:', context);
  console.error('Error Type:', typeof error);
  console.error('Error Name:', error?.name);
  console.error('Error Message:', error?.message);
  console.error('Error Code:', error?.code);
  console.error('Error Stack:', error?.stack);
  console.error('Error Keys:', Object.keys(error || {}));
  console.error('Full Error Object:', JSON.stringify(error, null, 2));
  console.error('==============================');
}
/**
 * Example for regional endpoint:
 *   const location = 'us-central1'
 *   const client = new SessionsClient({apiEndpoint: 'us-central1-dialogflow.googleapis.com'})
 */
//const client = new SessionsClient();
//const client = new SessionsClient({apiEndpoint: 'asia-south1-dialogflow.googleapis.com'})


async function detectIntentCX(client, request) {
  const startTime = Date.now();
  logger.debug('Dialogflow CX detectIntent started', {
    sessionPath: request.session,
    queryType: request.queryInput?.text ? 'text' : 'event',
    query: request.queryInput?.text?.text || request.queryInput?.event?.event,
    languageCode: request.queryInput?.languageCode
  });
  
  try {
    // ⚡ TIMEOUT PROTECTION: Set timeout for Dialogflow call
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Dialogflow CX timeout after 15 seconds')), 15000);
    });
    
    const detectPromise = client.detectIntent(request);
    const [response] = await Promise.race([detectPromise, timeoutPromise]);
    
    const processingTime = Date.now() - startTime;
    logger.debug('Dialogflow CX response received', {
      processingTimeMs: processingTime,
      hasQueryResult: !!response.queryResult,
      messageCount: response.queryResult?.responseMessages?.length || 0
    });
    
    // ⚡ VALIDATION: Check response structure
    if (!response.queryResult) {
      throw new Error('Dialogflow CX response missing queryResult');
    }
    
    let textResponse = [];
    let payloadResponse = [];
    let chips;
    let sessionEnd = false;
    
    for (const message of response.queryResult.responseMessages) {
      if (message.text) {
        textResponse.push(message.text.text);
      }
      else if (message.payload) {
        try {
          const convertedPayload = convertProtobufToJson(message.payload);
          payloadResponse.push(convertedPayload);
        } catch (payloadError) {
          logger.error('Failed to convert Dialogflow payload', {
            error: payloadError.message,
            payload: message.payload
          });
        }
      }
      else if (message.endInteraction) {
        sessionEnd = true;
      }
    }
    
    // ⚡ IMPROVED CHIPS LOGIC: Better handling of multiple payloads
    if (payloadResponse.length > 1) {
      chips = payloadResponse.find(item =>
        item.richContent?.some(content =>
          Array.isArray(content) && content.some(innerContent => innerContent.type === 'chips')
        )
      );
      if (!chips || (Array.isArray(chips) && chips.length === 0)) {
        chips = payloadResponse[0];
      }
    }
    else if (payloadResponse[0]) {
      chips = payloadResponse[0];
    }

    const result = { 
      answer: textResponse.join('\n\n'), 
      payload: chips, 
      sessionEnd,
      processingTime 
    };
    
    logger.info('Dialogflow CX response processed successfully', {
      answerLength: result.answer?.length || 0,
      hasPayload: !!result.payload,
      sessionEnd: result.sessionEnd,
      processingTimeMs: processingTime
    });
    
    return result;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // ⚡ DETAILED ERROR LOGGING: Include all error context
    const errorDetails = {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      stack: error.stack,
      processingTimeMs: processingTime,
      query: request.queryInput?.text?.text || request.queryInput?.event?.event,
      queryType: request.queryInput?.text ? 'text' : 'event',
      isTimeout: error.message?.includes('timeout') || false,
      sessionPath: request.session,
      languageCode: request.queryInput?.languageCode,
      timestamp: new Date().toISOString()
    };
    
    // ⚡ GRPC/API SPECIFIC ERRORS: Capture Google API error details
    if (error.code !== undefined) {
      errorDetails.grpcCode = error.code;
      errorDetails.grpcMessage = error.message;
      errorDetails.grpcDetails = error.details;
    }
    
    // ⚡ NETWORK/TIMEOUT SPECIFIC: Identify connection issues
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      errorDetails.networkError = true;
      errorDetails.errorType = 'network';
    } else if (error.message?.includes('timeout')) {
      errorDetails.timeoutError = true;
      errorDetails.errorType = 'timeout';
    } else if (error.code >= 400 && error.code < 500) {
      errorDetails.clientError = true;
      errorDetails.errorType = 'client';
    } else if (error.code >= 500) {
      errorDetails.serverError = true;
      errorDetails.errorType = 'server';
    } else {
      errorDetails.errorType = 'unknown';
    }
    
    logger.error('Dialogflow CX detectIntent failed', errorDetails);
    
    // ⚡ DEBUG: Output raw error for debugging
    debugError(error, 'detectIntentCX');
    
    // ⚡ THROW WITH CONTEXT: Add processing time to error
    error.processingTime = processingTime;
    error.isDialogflowError = true;
    error.errorType = errorDetails.errorType;
    throw error;
  }
}

//let response = await getCXResponse('atmprebuiltagent','asia-south1','9d9f910c-d14b-4489-b1f9-98c6c3e67c61','919762421929','en','yes');
//console.log(JSON.stringify(response,null,2));

export async function getCXResponse(query, targetAgent, sessionId, languageCode) {
  const startTime = Date.now();
  logger.info('Dialogflow CX text query started', {
    query: query?.substring(0, 100) + (query?.length > 100 ? '...' : ''),
    sessionId: sessionId,
    location: targetAgent?.location,
    agentId: targetAgent?.agentId
  });
  
  // ⚡ VALIDATION: Check required parameters
  if (!targetAgent || !targetAgent.location || !targetAgent.projectId || !targetAgent.agentId) {
    const error = new Error('Invalid targetAgent configuration for Dialogflow CX');
    error.invalidConfig = true;
    throw error;
  }
  
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    const error = new Error('Query text is required for Dialogflow CX');
    error.invalidQuery = true;
    throw error;
  }
  
  try {
    const client = new SessionsClient({ 
      apiEndpoint: `${targetAgent.location}-dialogflow.googleapis.com`,
      timeout: 15000 // 15 second timeout
    });
    
    const sessionPath = client.projectLocationAgentSessionPath(
      targetAgent.projectId,
      targetAgent.location,
      targetAgent.agentId,
      sessionId
    );
    
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: query.trim(),
        },
        languageCode: languageCode || 'en',
      },
      queryParams: {
        sessionTtl: { seconds: 86399 },
      },
    };
    
    const result = await detectIntentCX(client, request);
    
    logger.info('Dialogflow CX text query completed', {
      sessionId: sessionId,
      totalTimeMs: Date.now() - startTime,
      answerLength: result.answer?.length || 0,
      hasPayload: !!result.payload
    });
    
    return result;
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // ⚡ COMPREHENSIVE ERROR LOGGING: Include all context
    const errorContext = {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      stack: error.stack,
      query: query?.substring(0, 100) + (query?.length > 100 ? '...' : ''),
      fullQueryLength: query?.length || 0,
      sessionId: sessionId,
      targetAgentLocation: targetAgent?.location,
      targetAgentProjectId: targetAgent?.projectId,
      targetAgentId: targetAgent?.agentId,
      languageCode: languageCode,
      totalTimeMs: totalTime,
      isTimeout: error.message?.includes('timeout') || false,
      isDialogflowError: error.isDialogflowError || false,
      errorType: error.errorType || 'unknown',
      invalidConfig: error.invalidConfig || false,
      invalidQuery: error.invalidQuery || false,
      timestamp: new Date().toISOString()
    };
    
    // ⚡ GOOGLE API ERROR DETAILS: If available
    if (error.code !== undefined) {
      errorContext.grpcCode = error.code;
      errorContext.grpcDetails = error.details;
    }
    
    logger.error('Dialogflow CX text query failed', errorContext);
    
    // ⚡ DEBUG: Output raw error for debugging
    debugError(error, 'getCXResponse');
    
    // ⚡ ADD CONTEXT: Enhance error with call context
    error.queryType = 'text';
    error.sessionId = sessionId;
    error.totalTime = totalTime;
    throw error;
  }
}

export async function getCXEventResponse(event, targetAgent, sessionId, languageCode) {
  const startTime = Date.now();
  logger.info('Dialogflow CX event query started', {
    event: event,
    sessionId: sessionId,
    location: targetAgent?.location,
    agentId: targetAgent?.agentId
  });
  
  // ⚡ VALIDATION: Check required parameters
  if (!targetAgent || !targetAgent.location || !targetAgent.projectId || !targetAgent.agentId) {
    const error = new Error('Invalid targetAgent configuration for Dialogflow CX event');
    error.invalidConfig = true;
    throw error;
  }
  
  if (!event || typeof event !== 'string' || event.trim().length === 0) {
    const error = new Error('Event name is required for Dialogflow CX');
    error.invalidEvent = true;
    throw error;
  }
  
  try {
    const client = new SessionsClient({ 
      apiEndpoint: `${targetAgent.location}-dialogflow.googleapis.com`,
      timeout: 15000 // 15 second timeout
    });
    
    const sessionPath = client.projectLocationAgentSessionPath(
      targetAgent.projectId,
      targetAgent.location,
      targetAgent.agentId,
      sessionId
    );
    
    const request = {
      session: sessionPath,
      queryInput: {
        event: {
          event: event.trim(),
        },
        languageCode: languageCode || 'en',
      },
      queryParams: {
        sessionTtl: { seconds: 86399 },
      },
    };
    
    const result = await detectIntentCX(client, request);
    
    logger.info('Dialogflow CX event query completed', {
      event: event,
      sessionId: sessionId,
      totalTimeMs: Date.now() - startTime,
      answerLength: result.answer?.length || 0,
      hasPayload: !!result.payload
    });
    
    return result;
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // ⚡ COMPREHENSIVE ERROR LOGGING: Include all context
    const errorContext = {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      stack: error.stack,
      event: event,
      sessionId: sessionId,
      targetAgentLocation: targetAgent?.location,
      targetAgentProjectId: targetAgent?.projectId,
      targetAgentId: targetAgent?.agentId,
      languageCode: languageCode,
      totalTimeMs: totalTime,
      isTimeout: error.message?.includes('timeout') || false,
      isDialogflowError: error.isDialogflowError || false,
      errorType: error.errorType || 'unknown',
      invalidConfig: error.invalidConfig || false,
      invalidEvent: error.invalidEvent || false,
      timestamp: new Date().toISOString()
    };
    
    // ⚡ GOOGLE API ERROR DETAILS: If available
    if (error.code !== undefined) {
      errorContext.grpcCode = error.code;
      errorContext.grpcDetails = error.details;
    }
    
    logger.error('Dialogflow CX event query failed', errorContext);
    
    // ⚡ DEBUG: Output raw error for debugging
    debugError(error, 'getCXEventResponse');
    
    // ⚡ ADD CONTEXT: Enhance error with call context
    error.queryType = 'event';
    error.sessionId = sessionId;
    error.totalTime = totalTime;
    throw error;
  }
}

// ⚡ CONNECTIVITY TEST: Simple function to test Dialogflow connection
export async function testDialogflowConnectivity(targetAgent) {
  logger.info('Testing Dialogflow CX connectivity', { 
    location: targetAgent?.location,
    projectId: targetAgent?.projectId,
    agentId: targetAgent?.agentId
  });
  
  try {
    const testSessionId = 'test-session-' + Date.now();
    const result = await getCXResponse('hi', targetAgent, testSessionId, 'en');
    
    logger.info('Dialogflow CX connectivity test successful', {
      hasAnswer: !!result.answer,
      answerLength: result.answer?.length || 0,
      hasPayload: !!result.payload,
      processingTime: result.processingTime
    });
    
    return { success: true, result: result };
    
  } catch (error) {
    logger.error('Dialogflow CX connectivity test failed', {
      error: error.message,
      errorType: error.errorType,
      isDialogflowError: error.isDialogflowError
    });
    
    return { success: false, error: error.message, errorType: error.errorType };
  }
}