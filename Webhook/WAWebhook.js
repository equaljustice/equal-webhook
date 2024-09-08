import * as types from '../utils/types.js';
import { extractTextFromDocument, deleteFile } from '../utils/readFileData.js';
import { markAsRead, sendWatsAppReplyText, getWAMediaURL, downloadWAFile } from '../whatsApp/whatsAppAPI.js';
import { deleteAssistantThread, interactWithAssistant } from "../chatGPT/helpers/assistant-api.js";
import { deleteThread } from '../Services/redis/redisWAThreads.js';

const handleTextMessage = async (message, from) => {
    const messageBody = message.text.body;
    markAsRead(message.id, message.text.body);
    if(messageBody == 'RESTART'){
        const threadId = await deleteThread(from);
        deleteAssistantThread(threadId);
    }
    let response = await interactWithAssistant(messageBody, from, types.openAIAssist.EMP_OFFER);
    if(response.answer|| response.answer != '')
    await sendWatsAppReplyText(response.answer, from);
   
};

const handleDocumentMessage = async (message, from, phone_number_id) => {
    const message_id = message.id;
    const doc_id = message.document.id;
    const filename = message.document.filename;
    markAsRead(message_id, message.document.filename);
    const media = await getWAMediaURL(doc_id, phone_number_id);


    let filePath = await downloadWAFile(media.url, doc_id + '_' + filename);
    //await sendWatsAppReplyText("Please wait till I go through the document.", from);
    console.log('filePath: ', filePath);
    let pdfContent = await extractTextFromDocument(filePath, media.mime_type);

    let response = await interactWithAssistant(pdfContent, from, types.openAIAssist.EMP_OFFER);
    
    if (response.answer || response.answer != '') {
       await sendWatsAppReplyText(`${response.answer}`, from);
    }
    deleteFile(filePath);
};

const AnalyzeMessage = async (req, res) => {
    try {
        const message = req.body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const message_id = message.id;
        const phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
        switch (message.type) {
            case 'text':
                await handleTextMessage(message, from);
                break;
            case 'document':
                await handleDocumentMessage(message, from, phone_number_id);
                break;
            case 'image':
            case 'audio':
            case 'video':
                sendWatsAppReplyText("Received your media! We'll process it soon.", from);
                break;
            default:
                sendWatsAppReplyText("Unsupported message type.", from);
                break;
        }

        res.sendStatus(200);
    } catch (error) {
        console.log("Error in catch", error);
        res.sendStatus(500);
    }
};

export const getWhatsAppMsg = async (req, res) => {
    
    if (isStatusMessage(req.body)) {
        return;
    }
    else if (hasMessagesArray(req.body)) {
        console.log(JSON.stringify(req.body, null, 1));
        AnalyzeMessage(req, res);
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
