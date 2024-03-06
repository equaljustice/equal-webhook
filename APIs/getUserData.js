import { createLetter } from "../Services/createLetter.js";
import { createAssistantThread } from "../chatGPT/assistant-api.js";
import urbanPincodes from '../JSONs/urbanPincodes.json' assert {type: "json"};

const postUserAnswers = async (req, res) => {
     console.log('Input from API', JSON.stringify(req.body, null, 2));
    let userInputData = prepareInputData(req.body.data);
    userInputData.area_of_user = urbanPincodes.includes(Number(userInputData.area_of_user.slice(0, 3))) ? "urban" : "rural";
     var threadId = generateSessionId(15);
    console.log('Prepared Data', JSON.stringify(userInputData, null, 2));
    createLetter(req.body.fraudType, req.body.letterOption, userInputData, threadId) 
    res.send({downloadLink:'https://equal-webhook-nh3rcdoxhq-el.a.run.app/' + threadId});
}
const prepareInputData = (inputJson) => {
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
};
function generateSessionId(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sessionId = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    sessionId += charset.charAt(randomIndex);
  }

  return sessionId;
}
export { postUserAnswers };