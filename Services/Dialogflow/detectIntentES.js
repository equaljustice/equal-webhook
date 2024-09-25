import { SessionsClient } from '@google-cloud/dialogflow';
import { convertProtobufToJson } from '../../utils/protoJson.js';

// Instantiates a session client
const sessionClient = new SessionsClient();

async function detectIntent(
    projectId,
    sessionId,
    query,
    contexts,
    languageCode
) {
    // The path to identify the agent that owns the created intent.
    const sessionPath = sessionClient.projectAgentSessionPath(
        projectId,
        sessionId
    );

    // The text query request.
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: query,
                languageCode: languageCode,
            },
        },
    };

    if (contexts && contexts.length > 0) {
        request.queryParams = {
            contexts: contexts,
        };
    }

    const responses = await sessionClient.detectIntent(request);
    return responses[0];
}


export async function getActionFromDFES(query, sessionId){
    let response = await detectIntent('atmprebuiltagent', sessionId, query ,null, 'en');
    //console.log('DF_ES response',JSON.stringify(response.queryResult.fulfillmentMessages.filter(msg => msg.payload), null, 2));
    let payload = response.queryResult.fulfillmentMessages.filter(msg => msg.payload);
    if(payload && payload[0])
        return {payload: convertProtobufToJson(payload[0].payload), fulfillmentText: response.queryResult.fulfillmentText};
    else
        return {fulfillmentText: response.queryResult.fulfillmentText};
}

//console.log(await getActionFromDF('ATM fraud', '919762421929'));