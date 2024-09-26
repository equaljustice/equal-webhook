//const APIrouter = require('express').Router();
import express from 'express';
import { getCities, getStates } from './UI-APIs/StateCity.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { openQnAFineTuned } from './Webhook/DFQnA.js';
import { createDocWithFineTuned } from './Webhook/DFWebhook.js';
import { authenticate, authenticateToken } from './Services/authenticate.js';
import { listFiles, downloadFile } from './UI-APIs/getGCSFiles.js';
import { getWhatsAppMsg, verifywhatsapp } from './Webhook/WAWebhookNew.js';
const APIrouter = express.Router();

APIrouter.use('/getStates', getStates);
APIrouter.use('/getCities/:stateCode', getCities);
APIrouter.post('/webhook_QnAFineTuned', openQnAFineTuned);
APIrouter.post('/webhook_createDocWithFineTuned', createDocWithFineTuned);
APIrouter.post('/whatsappMessage', getWhatsAppMsg);
APIrouter.get('/whatsappMessage', verifywhatsapp)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
APIrouter.get('/secured', (req, res) => {
  res.sendFile(path.join(__dirname, 'secured.html'));
})
// Route to handle file download
APIrouter.get('/download/:threadId/:filename', (req, res) => {

  res.redirect(`https://storage.googleapis.com/ejustice-public-bucket/${req.params.threadId}/${req.params.filename}.docx?time=${new Date().getTime()}`);
});
APIrouter.get('/list-files/:folder', authenticateToken, listFiles);
APIrouter.get('/downloadFile/:folder/:filename', downloadFile);
APIrouter.post('/login', authenticate);
// Export the router
export default APIrouter;