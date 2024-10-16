import OpenAI from 'openai';
import { cleanJson } from './DFWebhook.js';
import { urbanPincodes } from '../JSONs/urbanPincodes.js'
import { createUserInputParagraph, removeKeys } from '../chatGPT/helpers/buildInputData.js';
import { openAiChatCompletion } from '../chatGPT/helpers/openAI.js';
import * as types from "../utils/types.js";
import { logger } from '../utils/logging.js';
export const openQnAFineTuned = async (req, res) => {
    logger.info(`QnA Request: ${JSON.stringify(req.body)}`);
    try {
        let sessionInfo = req.body.sessionInfo;
        let counter = sessionInfo.parameters.counter;
        let responseJson = '';
        let messagesHistory = sessionInfo.parameters.messages ? sessionInfo.parameters.messages : [];
        let userInputData;
        let generalData;
        let transactionArray;
        let queryMessage = [];
        if (messagesHistory.length == 0) {
            let sysMessage = [{
                role: "system",
                content: "restrict response to 1500 chars, remove annotations from the response"
            }];
            const tag = req.body.fulfillmentInfo.tag;
            switch (tag) {
                case types.transaction.ATM:
                    generalData = sessionInfo.parameters.generalData ?
                        cleanJson(sessionInfo.parameters.generalData)
                        : "";
                    transactionArray = sessionInfo.parameters.transactionArray ?
                        cleanJson(sessionInfo.parameters.transactionArray)
                        : "";
                    generalData.area_of_user = urbanPincodes.includes(Number(generalData.area_of_user.slice(0, 3))) ? "urban" : "rural";

                    userInputData = { ...generalData, transactionArray: [...transactionArray] }
                    break;
                case types.transaction.FAILED_TRANSACTION:
                    userInputData = sessionInfo.parameters ?
                        await cleanJson(sessionInfo.parameters): "";
                    userInputData.area_of_user = urbanPincodes.includes(Number(sessionInfo.parameters.area_of_user.slice(0, 3))) ? "urban" : "rural";
                    break;
                case types.transaction.UPI:
                    userInputData = sessionInfo.parameters ?
                        await cleanJson(sessionInfo.parameters) : "";
                    userInputData.area_of_user = urbanPincodes.includes(Number(sessionInfo.parameters.pincode.slice(0, 3))) ? "urban" : "rural";
                    break
                case types.travel.Flights:
                case types.employee.Retrenchment:
                    userInputData = sessionInfo.parameters ?
                        await cleanJson(sessionInfo.parameters) : "";
                    break;
                                    
                default:
                    userInputData = sessionInfo.parameters ?
                        await cleanJson(sessionInfo.parameters) : "";
            }
            //const updatedUserData = await removeKeys(userInputData);
            const userInputPara = await createUserInputParagraph(userInputData, tag);
            messagesHistory = sysMessage.concat([{ role: "user", content: userInputPara.paragraph }])
        }
        var responseMessage = '';
        let len = req.body.text.length;
        if (len > 300 && counter < 12) {
            responseMessage = "It's crossing 300 characters limit, please be within limit"
        } else if (counter == null || counter < 11 && len < 300) {

            queryMessage = queryMessage.concat([{
                role: "user",
                content: req.body.text
            }]);
            queryMessage = messagesHistory.concat(queryMessage);
            const QnAResponse = await openAiChatCompletion(queryMessage, types.openAIModels.OPEN_QNA, 0.8, 500, 1, 0.9, 0.2, 0);
            responseMessage = QnAResponse.choices[0].message.content
        } else {
            responseMessage = `Your questions limit is over, Thank you for using our service, hope your issue will be resolved.
             Reply EXIT to start new case.`

        }

        const message = [
            {
                role: "user",
                content: req.body.text
            },
            {
                role: "assistant",
                content: responseMessage
            }]
        const messages = messagesHistory.concat(message);
        responseJson = {
            fulfillment_response: {
                messages: [{
                    text: {
                        text: [responseMessage]
                    }
                }]
            },
            sessionInfo: {
                parameters: {
                    messages,
                    counter: counter+1,
                }
            }
        };


        res.json(responseJson);

    } catch (error) {
        console.error('Error handling the webhook request:', error);
        res.status(500).send('Error processing the request');
    }
};

async function openAiCompletionWithFineTunedQnA(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    //console.log("input to openAI", message);
    const completionResponse = await openai.chat.completions.create({
        model: "ft:gpt-3.5-turbo-1106:ashish-chandra::8xglmTtV",
        messages: message,
        temperature: temperature,
        max_tokens: 400,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}