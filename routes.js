//const APIrouter = require('express').Router();
import express from 'express';
import {getQuestionJson} from './APIs/ATMFraudQuestions.js';
import { getCities, getStates } from './APIs/StateCity.js';
import { getBanks } from './APIs/Banks.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { openQnA, createDocWithAssistant, createDocWithFineTuned } from './Dialogflow-webhook/finFraudwebhooks.js';
const APIrouter = express.Router();

APIrouter.use('/atmfraud', getQuestionJson);
APIrouter.use('/getStates', getStates);
APIrouter.use('/getCities/:stateCode', getCities);
APIrouter.use('/getBanks', getBanks);
APIrouter.post('/webhook_QnA', openQnA);
APIrouter.post('/webhook_createDoc', createDocWithAssistant);
APIrouter.post('/webhook_createDocWithFineTuned', createDocWithFineTuned);
APIrouter.get('1/:session', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Download File</title>
      <style>
          body {
              font-family: 'Arial', sans-serif;
              background-color: #f4f4f4;
              text-align: center;
              padding: 50px;
          }
          h1 {
              color: #333;
              margin-bottom: 20px;
          }
          a {
              text-decoration: none;
          }
          button {
              background-color: #4CAF50;
              color: white;
              padding: 15px 30px;
              font-size: 18px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              transition: background-color 0.3s ease;
          }
          button:hover {
              background-color: #45a049;
          }
      </style>
  </head>
  <body>
      <h1>Welcome to equaljustice.ai! Kindly download your file and go back to the previous tab.</h1>
      <p><a href="/download/${req.params.session}" download>
          <button>Download Bank letter- Fine Tuned model</button>
      </a></p>
      <p><a href="/download/${req.params.session}original_3_5" download>
      <button>Download Bank letter- 3.5 model</button>
  </a></p>
  </body>
  </html>    
  `);
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
APIrouter.get('/:threadId', (req, res) => {
    res.sendFile(path.join(__dirname, 'download.html'));
});
// Route to handle file download
APIrouter.get('/download/:threadId/:filename', (req, res) => {
  
  res.redirect(`https://storage.googleapis.com/ejustice-public-bucket/${req.params.threadId}/${req.params.filename}.docx?time=${new Date().getTime()}`);
});

// Export the router
export default APIrouter;