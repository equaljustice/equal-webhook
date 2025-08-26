import { SessionsClient } from '@google-cloud/dialogflow-cx';
import { convertProtobufToJson } from '../../utils/protoJson.js';
import { logger } from '../../utils/logging.js';
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
    logger.error('Dialogflow CX detectIntent failed', {
      error: error.message,
      stack: error.stack,
      processingTimeMs: processingTime,
      query: request.queryInput?.text?.text || request.queryInput?.event?.event,
      isTimeout: error.message.includes('timeout')
    });
    
    // ⚡ THROW WITH CONTEXT: Add processing time to error
    error.processingTime = processingTime;
    error.isDialogflowError = true;
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
    logger.error('Dialogflow CX text query failed', {
      error: error.message,
      stack: error.stack,
      query: query?.substring(0, 100),
      sessionId: sessionId,
      targetAgent: targetAgent,
      totalTimeMs: Date.now() - startTime,
      isTimeout: error.message?.includes('timeout'),
      isDialogflowError: error.isDialogflowError
    });
    
    // ⚡ ADD CONTEXT: Enhance error with call context
    error.queryType = 'text';
    error.sessionId = sessionId;
    error.totalTime = Date.now() - startTime;
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
    logger.error('Dialogflow CX event query failed', {
      error: error.message,
      stack: error.stack,
      event: event,
      sessionId: sessionId,
      targetAgent: targetAgent,
      totalTimeMs: Date.now() - startTime,
      isTimeout: error.message?.includes('timeout'),
      isDialogflowError: error.isDialogflowError
    });
    
    // ⚡ ADD CONTEXT: Enhance error with call context
    error.queryType = 'event';
    error.sessionId = sessionId;
    error.totalTime = Date.now() - startTime;
    throw error;
  }
}