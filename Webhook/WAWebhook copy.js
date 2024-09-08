import * as types from '../utils/types.js'
import { extractTextFromDocument } from '../utils/readFileData.js'
import { markAsRead, sendWatsAppReplyText, getWAMediaURL, downloadWAFile } from '../whatsApp/whatsAppAPI.js';
import { interactWithAssistant } from "../chatGPT/helpers/assistant-api.js";


const AnalyzeTextResponse = async (req, res) => {

    try {
        const message = req.body.entry[0].changes[0].value.messages[0];
        const messageBody = message.text.body;
        const from = message.from;
        const message_id = message.id;
        let response;
        var threadId;
        markAsRead(message_id);
        response = await interactWithAssistant(messageBody, from, types.openAIAssist.EMP_OFFER);
        threadId = response.threadId;
        sendWatsAppReplyText(response.text, from);

        res.sendStatus(200);
    } catch (error) {
        console.log("error in catch", error);
        res.sendStatus(500);
    }

};
const AnalyzeJobOfferDoc = async (req, res) => {

    try {
        const message = req.body.entry[0].changes[0].value.messages[0];
        const message_id = message.id;
        const doc_id = message.document.id;
        const from = message.from;
        const phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
        const filename = message.document.filename
        markAsRead(message_id);

        const media = await getWAMediaURL(doc_id, phone_number_id);
        sendWatsAppReplyText("Please wait till I go through the document.", from);

        const filePath = await downloadWAFile(media.url, message_id + filename);
        const pdfContent = await extractTextFromDocument(filePath, media.mime_type);

        let response = await interactWithAssistant(pdfContent, from, types.openAIAssist.EMP_OFFER);
        if (!messageBody) {
            res.sendStatus(200);
            return;
        }
        if (response.text)
            sendWatsAppReplyText(response.text, from);


    } catch (error) {
        console.log("error in catch", error);
        res.sendStatus(500);
    }

};

export const getWhatsAppMsg = async (req, res) => {
    console.log(JSON.stringify(req.body, null, 2));
    if (hasDocumentMessages(req.body)) {
        return AnalyzeJobOfferDoc(req, res);
    }
    if (hasMessagesArray(req.body)) {
        return AnalyzeTextResponse(req, res);
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
    return hasMessagesArray(data) && data.entry[0].changes[0].value.messages[0].type == 'document';
}
