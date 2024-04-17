//const APIrouter = require('express').Router();
import express from 'express';
import { getQuestionJson } from './APIs/getQuestions.js';
import { getCities, getStates } from './APIs/StateCity.js';
import { getBanks } from './APIs/Banks.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { openQnA, createDocWithAssistant, createDocWithFineTuned } from './Dialogflow-webhook/finFraudwebhooks.js';
import { openQnAFineTuned } from './Dialogflow-webhook/qnaCompletion.js';
import { postUserAnswers } from './APIs/getUserData.js'
import { authenticate, authenticateToken } from './Services/authenticate.js';
import { listFiles, downloadFile } from './APIs/getGCSFiles.js';
import { getSysFiles, downloadSysFiles } from './APIs/getRootFiles.js';
const APIrouter = express.Router();

APIrouter.use('/getQuestions', getQuestionJson);
APIrouter.use('/getStates', getStates);
APIrouter.use('/getCities/:stateCode', getCities);
APIrouter.use('/getBanks', getBanks);
APIrouter.post('/webhook_QnA', openQnA);
APIrouter.post('/postUserData', postUserAnswers);
APIrouter.post('/webhook_QnAFineTuned', openQnAFineTuned);
APIrouter.post('/webhook_createDoc', createDocWithAssistant);
APIrouter.post('/webhook_createDocWithFineTuned', createDocWithFineTuned);
APIrouter.use('/getSysFiles', getSysFiles);
APIrouter.use('/downloadSysFile', downloadSysFiles);

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