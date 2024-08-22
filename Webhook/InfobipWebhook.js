
import * as constants from '../constants.js';
import * as types from '../utils/types.js'
import {
    ATMLegalTrainingData, EmployeeTrainingData,
    EmployeeTrainingData_PoliceComplaint, FailedTransactionLegalTrainingData,
    UPILegalTrainingData, FlightsTrainingData
} from "../LegalMaterial/legalTrainingData.js";
import { extractTextFromDocument } from '../utils/readFileData.js'
import { markAsRead, sendWatsAppReplyText, getWAMediaURL } from '../whatsApp/whatsAppAPI.js';
import { interactWithAssistant } from "../chatGPT/helpers/assistant-api.js";
import { utils } from 'mocha';



export const AnalyzeJobOffer = async (req, res) => {

    try {
        //console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
        const messageBody = req.body.entry[0].changes[0].value.messages[0].text.body;
        const from = req.body.entry[0].changes[0].value.messages[0].from;
        const message_id = req.body.entry[0].changes[0].value.messages[0].id;
        let userInputData, legalTrainingData, response;
        var threadId;// = req.body.results[0].messageId ? req.body.results[0].messageId : generateSessionId(15);
        const tag = ' ';
        let textResponse = 'Invalid request';
        //await markAsRead(req.body.results[0].from, req.body.results[0].messageId);
        //response = await interactWithAssistant(req.body.results[0].message.text, req.body.results[0].threadId, 'asst_ouENsY02xWT4JowVZf7AwEi3');
        markAsRead(message_id);
        response = await interactWithAssistant(messageBody, '', 'asst_ouENsY02xWT4JowVZf7AwEi3');
        threadId = response.threadId;
        //if(response.text)
        //await sendWatsAppReplyText(response.text, req.body.results[0].to, req.body.results[0].from);
        sendWatsAppReplyText(response.text, from);

        /*  textResponse = `Creating ${option}, Please wait`;
         docName = `${option}`;
         option = option.split(' ').join('_');
         fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + tag + '_' + option + '.docx';
         createLetter(tag, option, userInputData, legalTrainingData, threadId, openAiConfig);
  */
        const responseJson = {
            messages: {
                text: {
                    text: [response.text]
                }
            },
            sessionInfo: {
                parameters: { threadId }
            }
        };
        res.json(responseJson);
    } catch (error) {
        console.log("error in catch", error);
        res.json({
            fulfillment_response: {
                messages: [{
                    text: {
                        text: ["Something went wrong"]
                    }
                }]
            }
        });
    }

};

export const AnalyzeJobOfferLetter = async (req, res) => {

    try {

        //console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
        const message_id = req.body.entry[0].changes[0].value.messages[0].id;
        const from = req.body.entry[0].changes[0].value.messages[0].from;
        markAsRead(message_id);
        sendWatsAppReplyText("Please wait till I go through the document.", from);
        const media = await getWAMediaURL(req.body.entry[0].changes[0].value.messages[0].document.id, req.body.entry[0].changes[0].value.metadata.phone_number_id);

        const messageBody = await extractTextFromDocument(media.url, media.mime_type, media.sha256);


        let userInputData, legalTrainingData, response;
        var threadId;// = req.body.results[0].messageId ? req.body.results[0].messageId : generateSessionId(15);
        const tag = ' ';
        let textResponse = 'Invalid request';
        //await markAsRead(req.body.results[0].from, req.body.results[0].messageId);
        //response = await interactWithAssistant(req.body.results[0].message.text, req.body.results[0].threadId, 'asst_ouENsY02xWT4JowVZf7AwEi3');
        if (!messageBody) {
            res.sendStatus(200);
            return;
        }
        response = await interactWithAssistant(messageBody, '', 'asst_ouENsY02xWT4JowVZf7AwEi3');
        threadId = response.threadId;
        //if(response.text)
        //await sendWatsAppReplyText(response.text, req.body.results[0].to, req.body.results[0].from);
        sendWatsAppReplyText(response.text, from);

        /*  textResponse = `Creating ${option}, Please wait`;
         docName = `${option}`;
         option = option.split(' ').join('_');
         fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + tag + '_' + option + '.docx';
         createLetter(tag, option, userInputData, legalTrainingData, threadId, openAiConfig);
  */
        const responseJson = {
            messages: {
                text: {
                    text: [response.text]
                }
            },
            sessionInfo: {
                parameters: { threadId }
            }
        };
        res.json(responseJson);
    } catch (error) {
        console.log("error in catch", error);
        res.json({
            fulfillment_response: {
                messages: [{
                    text: {
                        text: ["Something went wrong"]
                    }
                }]
            }
        });
    }

};

export const verifywhatsapp = async (req, res) => {
    console.log(JSON.stringify(req.body, null, 2));
    if (hasDocumentMessages(req.body)) {
        return AnalyzeJobOfferLetter(req, res);
    }
    if (hasMessagesArray(req.body)) {
        return AnalyzeJobOffer(req, res);
    }

    else if (
        req.query['hub.mode'] == 'subscribe' &&
        req.query['hub.verify_token'] == 'testtoken'
    ) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(200);
    }
};

function hasMessagesArray(data) {
    // Check if the entry array, changes array, and messages array exist
    return data.entry && data.entry[0].changes && data.entry[0].changes[0].value && Array.isArray(data.entry[0].changes[0].value.messages);
}

function hasDocumentMessages(data) {
    // Check if the entry array, changes array, and messages array exist
    return hasMessagesArray(data) && data.entry[0].changes[0].value.messages[0].type == "document";
}
