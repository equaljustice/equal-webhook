import { createLetter } from "../chatGPT/createDocuments.js";
import { urbanPincodes } from '../JSONs/urbanPincodes.js'
import * as constants from '../constants.js';
import * as types from '../utils/types.js'
import { ATMLegalTrainingData, FailedTransactionLegalTrainingData, UPILegalTrainingData } from "../LegalMaterial/legalTrainingData.js";

export const postUserAnswers = async (req, res) => {
  try{
  console.log('Input from API', JSON.stringify(req.body, null, 2));
  let userInputData = prepareInputData(req.body.data);
  userInputData.area_of_user = urbanPincodes.includes(Number(userInputData.area_of_user.slice(0, 3))) ? "urban" : "rural";
  var threadId = req.body.threadId || generateSessionId(15);
  console.log('Prepared Data', JSON.stringify(userInputData, null, 2));
  let openAiConfig = {
    model: types.openAIModels.GPT3_5,
    temperature: 0.25,
    max_tokens: 1500,
    n: 1,
    top_p: 1,
    frequency_penalty: 1,
    presence_penalty: 0,
  }
  await createLetter(req.body.fraudType, req.body.letterOption.replace(' ', ''), userInputData, ATMLegalTrainingData, threadId, openAiConfig);
  let fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + req.body.fraudType + '_' + req.body.letterOption.replace(' ', '') + '.docx';
        
  res.send({ downloadLink: fileURL });
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