import * as types from '../utils/types.js';
import { logger } from '../utils/logging.js';
import { extractTextFromDocument, deleteFile } from '../utils/readFileData.js';
import { markAsRead, sendWatsAppReplyText, getWAMediaURL, downloadWAFile, sendWatsAppWithButtons, sendWatsAppWithList, sendWatsAppWithRedirectButton, sendWatsAppVideo } from '../whatsApp/whatsAppAPI.js';
import { interactWithAssistant, createAssistantThread } from "../chatGPT/helpers/assistant-api.js";
import { deleteSession, getSession, saveSession } from '../Services/redis/redisWASession.js';
import { getActionFromDF } from '../Services/Dialogflow/detectIntentES.js';
import { getCXResponse } from '../Services/Dialogflow/detectIntentCX.js';
import { DFchipsToButtonOrList } from '../whatsApp/DFchipsToButtons.js';

const handlInteractiveButtons = async (message, from, phone_number_id) => {
    switch (message.interactive.type) {
        case 'button_reply':
            message.text = { "body": message.interactive.button_reply.id };
            break;
        case 'list_reply':
            message.text = { "body": message.interactive.list_reply.description };
            break;
        default:
            message.text = { "body": 'Yes' };

    }

    handleTextMessage(message, from, phone_number_id);
}
const handleTextMessage = async (message, from, phone_number_id) => {
    markAsRead(message.id, phone_number_id);
    let response = {
        answer: 'Please reply from one of the below option'
    }

    let buttons = [
        {
            type: "reply",
            reply: {
                id: 'ATMFraud',
                title: 'ATM Fraud'
            }
        },
        {
            type: "reply",
            reply: {
                id: 'AnalyzeOfferLetter',
                title: 'Analyze Offer Letter'
            }
        }
    ]
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
                    }
                ]
            },
            {
                title: "Employment",
                rows: [
                    {
                        "id": "Employemnt Termination",
                        "title": "Employment Termination",
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
                        "description": "Issues while Travelling in Flight"
                    },
                    {
                        "id": "Trains",
                        "title": "Trains Grievances",
                        "description": "Issues while Travelling in Train"
                    }
                ]
            }
        ]
    }

    let threadId;
    if (message.text.body == 'RESTART') {
        threadId = await deleteSession(from);
        //deleteAssistantThread(threadId);
        //sendWatsAppReplyText(response.answer, from, phone_number_id);
        //sendWatsAppWithButtons(response.answer, buttons, {}, '', from, phone_number_id);
        sendWatsAppWithList(response.answer, options, 'How can I help you Today?', 'EqualJustice.ai', from, phone_number_id);
        return;
    }
    let session = await getSession(from);
    if (!session) {
        let DFResponse = await getActionFromDF(message.text.body, from);//call dialogflow ES detectIntent to get action

        if (DFResponse && DFResponse.action && DFResponse.agentType) {
            if (DFResponse.agentType == 'assistant') {
                threadId = await createAssistantThread(from);
            }
            else {
                threadId = from;
            }
            session = {
                threadId: threadId,
                action: DFResponse.action,
                agentType: DFResponse.agentType,
                targetAgent: DFResponse.targetAgent
            }
            message.text = { "body": "hi"}
            saveSession(from, threadId, DFResponse.action, DFResponse.agentType, DFResponse.targetAgent);
        }
        else if(DFResponse && DFResponse.action){
            session = {
                action: DFResponse.action
            }
        }
        else {
            sendWatsAppWithList(response.answer, options, 'How can I help you Today?', 'EqualJustice.ai', from, phone_number_id);
            return;
        }
    }
    //console.log("session", session);
    switch (session.action) {
        case types.transaction.ATM:
        case types.transaction.UPI:
        case types.transaction.FAILED_TRANASACTION:
        case types.employee.Retrenchment:
        case types.travel.Flights:
            response = await getCXResponse(session.targetAgent, session.threadId, 'en', message.text.body); 
            break;
        case types.employee.Offer:
            response = await interactWithAssistant(message.text.body, from, session.targetAgent.assistantId, session.threadId, session.action, session.targetAgent);
            break;
        case types.actions.Welcome:
            sendWatsAppWithList(response.answer, options, 'How can I help you Today?', 'EqualJustice.ai', from, phone_number_id);
            sendWatsAppVideo(from, phone_number_id);
            return;
        case types.actions.Fallback:
            sendWatsAppWithList(response.answer, options, 'How can I help you Today?', 'EqualJustice.ai', from, phone_number_id);
            return;
        default:
            response = {
                answer: `This use case is under development, Please try again this later`
            }
    }
    if (response.payload && response.answer) {
        let options = DFchipsToButtonOrList(response.payload);
        logger.info(`WhatsApp Reply ${from} :: ${message.text.body} :: Response:: ${response.answer}`);
        if (options.button)
            sendWatsAppWithList(response.answer, options, '', '', from, phone_number_id);
        else if (Array.isArray(options) && options.length> 0 && options.filter(option => option.type === 'reply'))
            sendWatsAppWithButtons(response.answer, options, '', from, phone_number_id);
        else if (options.name && options.name == 'cta_url')
            sendWatsAppWithRedirectButton(response.answer, options, 'Download Document', '', from, phone_number_id);
        else
            sendWatsAppReplyText(response.answer, from, phone_number_id);
    }
    else if (response.answer || response.answer != '')
        sendWatsAppReplyText(response.answer, from, phone_number_id);
    if(response.sessionEnd){
        deleteSession(from);
    }

};

const handleDocumentMessage = async (message, from, phone_number_id) => {

    let media = await getWAMediaURL(message.document.id, phone_number_id);

    let filePath = await downloadWAFile(media.url, message.document.id + '_' + message.document.filename);
    //await sendWatsAppReplyText("Please wait till I go through the document.", from);
    logger.info(filePath);
    let pdfContent = await extractTextFromDocument(filePath, media.mime_type);
    /* let response = await interactWithAssistant(pdfContent, from, types.openAIAssist.EMP_OFFER);
    if (response.answer || response.answer != '') {
        await sendWatsAppReplyText(response.answer, from, phone_number_id);
    } */
    message.text = { "body": pdfContent };
    handleTextMessage(message, from, phone_number_id);

    deleteFile(filePath);
};

const AnalyzeMessage = async (req, res) => {
    try {
        let message = req.body.entry[0].changes[0].value.messages[0];
        let phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
        switch (message.type) {
            case 'text':
                await handleTextMessage(message, message.from, phone_number_id);
                break;
            case 'document':
                await handleDocumentMessage(message, message.from, phone_number_id);
                break;
            case 'interactive':
                await handlInteractiveButtons(message, message.from, phone_number_id);
                break;
            case 'image':
            case 'audio':
                break;
            case 'video':
                let media = await getWAMediaURL(message.video.id, phone_number_id);
                logger.info(JSON.stringify(media));
                //sendWatsAppReplyText("Received your media.", message.from);
                break;
            case 'reaction':
                break;
            default:
                //sendWatsAppReplyText("Unsupported message type.", message.from);
                break;
        }


    } catch (error) {
        logger.error(error);

    }
};

export const getWhatsAppMsg = async (req, res) => {

    if (isStatusMessage(req.body)) {
        res.sendStatus(200);
    }
    else if (hasMessagesArray(req.body)) {
        logger.info(req.body);
        AnalyzeMessage(req, res);
        res.sendStatus(200);
    }
    else if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === 'testtoken') {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(200);
    }
};

function hasMessagesArray(data) {
    return data.entry && data.entry[0].changes && data.entry[0].changes[0].value && Array.isArray(data.entry[0].changes[0].value.messages);
}
function isStatusMessage(data) {
    return data.entry && data.entry[0].changes && data.entry[0].changes[0].value && Array.isArray(data.entry[0].changes[0].value.statuses);
}
