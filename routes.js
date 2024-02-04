//const APIrouter = require('express').Router();
import express from 'express';
import {getQuestionJson} from './APIs/ATMFraudQuestions.js';
import { getCities, getStates } from './APIs/StateCity.js';
import { getBanks } from './APIs/Banks.js';
import { openQnA, createDoc } from './Dialogflow-webhook/finFraudwebhooks.js';
const APIrouter = express.Router();

APIrouter.use('/atmfraud', getQuestionJson);
APIrouter.use('/getStates', getStates);
APIrouter.use('/getCities/:stateCode', getCities);
APIrouter.use('/getBanks', getBanks);
APIrouter.post('/webhook_QnA', openQnA);
APIrouter.post('/webhook_createDoc', createDoc);
APIrouter.get('/', (req, res) => {
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
      <a href="/download" download>
          <button>Download File</button>
      </a>
  </body>
  </html>    
  `);
});

// Route to handle file download
APIrouter.get('/download', (req, res) => {
  
  res.redirect(`https://storage.googleapis.com/ejustice-public-bucket/letter-to-bank%2Foutput.docx?time=${new Date().getTime()}`); // Set the download response
});

// Export the router
export default APIrouter;