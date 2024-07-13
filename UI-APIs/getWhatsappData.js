import { createLetter } from "../chatGPT/createDocuments.js";
import { urbanPincodes } from '../JSONs/urbanPincodes.js'
import * as constants from '../constants.js';
import * as types from '../utils/types.js'
import { ATMLegalTrainingData, FailedTransactionLegalTrainingData, UPILegalTrainingData } from "../LegalMaterial/legalTrainingData.js";

export const postWhatsAppUserAnswers = async (req, res) => {
  try{
  console.log('Input from API', req.body);
   const convertJson = (input) => {
    const output = {};
  
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        let value = input[key];
  
        // Check if value is a JSON string and try to parse it
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Do nothing if parsing fails, keep the original string value
          }
        }
  
        // If value is an object and contains the 'payload' key, use its value
        if (value && typeof value === 'object' && 'payload' in value) {
          output[key] = value.payload;
        } else {
          // Otherwise, keep the original value
          output[key] = input[key];
        }
      }
    }
  
    return output;
  }; 
  
  const outputJson = convertJson(req.body);
  console.log(JSON.stringify(req.body, null, 2));
  res.send({status:"success"});
  
}catch(err){
  console.log(err);
}
}
export const prepareInputData = (inputJson) => {
  try{
  const outputJson = {}
  inputJson.forEach(item => {
    if (item.parameter === 'fraud_transactions_count') {
      outputJson['transactions'] = [];
      for (const key in item.transactions) {
        const transactionObj = {};
        item.transactions[key].forEach(transaction => {

          transactionObj[transaction.parameter] = transaction.answer;

        });
        outputJson['transactions'].push(transactionObj);
      }
    } else {
      outputJson[item.parameter] = item.answer;
    }
  });
  return outputJson;
}catch(err){
  console.log(err);
}
};
export function generateSessionId(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sessionId = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    sessionId += charset.charAt(randomIndex);
  }

  return sessionId;
}