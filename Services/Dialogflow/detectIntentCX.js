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


async function detectIntentCX(projectId, location, agentId, sessionId, languageCode, query) {
  // const sessionId = Math.random().toString(36).substring(7);
  const client = new SessionsClient({ apiEndpoint: `${location}-dialogflow.googleapis.com` })
  const sessionPath = client.projectLocationAgentSessionPath(
    projectId,
    location,
    agentId,
    sessionId
  );
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: query,
      },
      languageCode,
    },
    queryParams: {
      sessionTtl: { seconds: 86399 },
    },
  };
  const [response] = await client.detectIntent(request);
  let textResponse = [];
  let payloadResponse = [];
  let chips;
  let sessionEnd = false;
  for (const message of response.queryResult.responseMessages) {
    if (message.text) {
      //console.log(`Agent Response: ${message.text.text}`);
      textResponse.push(message.text.text);
    }
    else if (message.payload) {
      //console.log(`Agent payload: ${JSON.stringify(convertProtobufToJson(message.payload))}`);
      payloadResponse.push(convertProtobufToJson(message.payload));
    }
    else if (message.endInteraction)
      sessionEnd = true
  }
  if (payloadResponse.length > 1) {
    chips = payloadResponse.find(item =>
      item.richContent.some(content =>
        content.some(innerContent => innerContent.type === 'chips')
      ));
  }
  else if (payloadResponse[0])
    chips = payloadResponse[0]

  return { answer: textResponse.join('\n\n'), payload: chips, sessionEnd }
}

//let response = await getCXResponse('atmprebuiltagent','asia-south1','9d9f910c-d14b-4489-b1f9-98c6c3e67c61','919762421929','en','yes');
//console.log(JSON.stringify(response,null,2));

export async function getCXResponse(query, targetAgent, sessionId, languageCode) {
  //console.log("targetAgent project", targetAgent.projectId);
  return await detectIntentCX(targetAgent.projectId, targetAgent.location, targetAgent.agentId, sessionId, languageCode, query);
}