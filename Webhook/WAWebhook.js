import * as types from '../utils/types.js';
import { logger } from '../utils/logging.js';
import { extractTextFromDocument, deleteFile } from '../utils/readFileData.js';
import { markAsRead, sendWatsAppReplyText, getWAMediaURL, downloadWAFile } from '../whatsApp/whatsAppAPI.js';
import { deleteAssistantThread, interactWithAssistant } from "../chatGPT/helpers/assistant-api.js";
import { deleteThread } from '../Services/redis/redisWAThreads.js';

const handleTextMessage = async (message, from, phone_number_id) => {
    markAsRead(message.id, phone_number_id);
    if (message.text.body == 'RESTART') {
        const threadId = await deleteThread(from);
        deleteAssistantThread(threadId);
        message.text.body = 'Hi';
    }
    let response = await interactWithAssistant(message.text.body, from, types.openAIAssist.EMP_OFFER);
    if (response.answer || response.answer != '')
        await sendWatsAppReplyText(response.answer, from, phone_number_id);

};

const handleDocumentMessage = async (message, from, phone_number_id) => {
    markAsRead(message.id, phone_number_id);
    let media = await getWAMediaURL(message.document.id, phone_number_id);

    let filePath = await downloadWAFile(media.url, message.document.id + '_' + message.document.filename);
    //await sendWatsAppReplyText("Please wait till I go through the document.", from);
    logger.info(filePath);
    let pdfContent = await extractTextFromDocument(filePath, media.mime_type);
    let response = await interactWithAssistant(pdfContent, from, types.openAIAssist.EMP_OFFER);
    if (response.answer || response.answer != '') {
        await sendWatsAppReplyText(response.answer, from, phone_number_id);
    }
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
            case 'image':
            case 'audio':
            case 'video':
                //sendWatsAppReplyText("Received your media.", message.from);
                break;
            case 'reaction':
                break;
            default:
                //sendWatsAppReplyText("Unsupported message type.", message.from);
                break;
        }


    } catch (error) {
        console.log("Error in catch", error);

    }
};

export const getWhatsAppMsgSingle = async (req, res) => {

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
