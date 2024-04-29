import { removeKeys } from '../chatGPT/helpers/buildInputData.js';
import { prepareInputData } from './postUserData.js'
import { urbanPincodes } from '../JSONs/urbanPincodes.js'
import * as types from '../utils/types.js'
import { openAiChatCompletion } from '../chatGPT/helpers/openAI.js';
import { createUserInputParagraph } from '../chatGPT/helpers/buildInputData.js';
export const postOpenQuestion = async (req, res) => {
    console.log('Input from API', JSON.stringify(req.body, null, 2));
    try {
       var threadId = req.body.threadId || generateSessionId(15);
        
        
        var counter = req.body.sessionHistory?.counter ? req.body.sessionHistory.counter : 1;
        var responseJson = '';
        var messagesHistory = req.body.sessionHistory?.messages ? req.body.sessionHistory.messages : [];

        let queryMessage = [];
        if (counter == 1) {
            let sysMessage = [{
                role: "system",
                content: "restrict response to 1500 chars, remove annotations from the response"
            }];
            let userInputData = prepareInputData(req.body.data);
           // userInputData.area_of_user = urbanPincodes.includes(Number(userInputData.area_of_user.slice(0, 3))) ? "urban" : "rural";
            console.log('Prepared Data', JSON.stringify(userInputData, null, 2));
            const updatedUserData = await removeKeys(userInputData);
            const userInputPara = await createUserInputParagraph(updatedUserData, req.body.fraudType);

            messagesHistory = sysMessage.concat([{ role: "user", content: userInputPara }]);
        }
        var responseMessage = '';
        if (req.body.question.length > 300 && counter < 12) {
            responseMessage = "It's crossing 300 characters limit, please be within limit"
        } else if (counter < 11 && req.body.question.length < 300) {

            queryMessage = queryMessage.concat([{
                role: "user",
                content: req.body.question
            }]);
            queryMessage = messagesHistory.concat(queryMessage);
            const QnAResponse = await openAiChatCompletion(queryMessage, types.openAIModels.OPEN_QNA, 0.8, 500, 1, 0.9, 0.2, 0);
            responseMessage = QnAResponse.choices[0].message.content
        } else {
            responseMessage = "Your questions limit is over, Thank you for using our service, hope your issue will be resolved"

        }

        const message = [
            {
                role: "user",
                content: req.body.question
            },
            {
                role: "assistant",
                content: responseMessage
            }]
        const messages = messagesHistory.concat(message);
        counter = counter + 1;
        responseJson = {

            answer: responseMessage,

            sessionHistory: {
                messages,
                counter,
                threadId

            }
        };


        res.json(responseJson);

    } catch (error) {
        console.error('Error handling the webhook request:', error);
        res.status(500).send('Error processing the request');
    }
};