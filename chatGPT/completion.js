import OpenAI from 'openai';
import {prompts} from "./prompts.js"

import LegalTrainingATM from '../JSONs/LegalTrainingATM.json' assert {type: "json"}; 


export async function getLetterContent(prompttype, userInputData) {
  try{
  const legalTraining = await getLegalTrainingMaterials(userInputData);
  const message= [
    {
      "role": "system",
      "content": `${prompts[prompttype]}`
    },
    {
      "role": "user",
      "content": `here is the Json data which contains information about fraud ${JSON.stringify(userInputData)}
${legalTraining} Generate a comprehensive, well-structured letter incorporating all the above elements, tailored to the specific details provided by the user and aligned with the legal guidelines. The letter should be professional, convincing, and geared towards achieving a positive outcome for the user`
    }
  ]
  
const letterResponse = await openAiCompleteion(message);
console.log("openAI Response", letterResponse);
return letterResponse.choices[0].message.content;
  }
  catch(error){
    error
  }
}
//const userInputData = {"pension_savings_account":"No","applied_for_atm":"Yes","withdrawing_regularly_from_atm":"Yes","bank_name":"HDFC Bank","Senior_citizen":"Yes","lost_atm":"No","withdrawn_amount_exceed_daily_limit":"No","atm_pin_shared":"Yes","was_bank_website":"Yes","atm_pin_shared_using":"Mobile App","area_pincode":"400060","bank_website_url":"www.hfdcfinance.co"}

  
async function openAiCompleteion(message){
  const openai = new OpenAI(process.env.OPENAI_API_KEY);
  console.log("input to openAI", message);
  const completionResponse = await openai.chat.completions.create({
    model: "ft:gpt-3.5-turbo-0613:personal::8twTZDyP",
    messages: message,
    temperature: 0.5,
    max_tokens: 1500,
    n:1,
    top_p: 1,
    frequency_penalty: 1.07,
    presence_penalty: 0,
  });
  return completionResponse;
}
async function getLegalTrainingMaterials1(userInputData) {
  const result = [];

  for (const key in userInputData) {
    const matchingQuestions = LegalTrainingATM.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === userInputData[key].toLowerCase());
    
    matchingQuestions.forEach(matchingQuestion => {
      result.push(matchingQuestion.LegalTrainingMaterial);
    });
  }

  return result;
}

async function getLegalTrainingMaterials(userInputData) {
  const result = [];

  const processValue = async (key, value) => {
    if (typeof value === 'object') {
      // If the value is an object (either JSON object or array), process recursively
      for (const key in value) {
        const nestedResult = await getLegalTrainingMaterials(value[key]);
        result.push(...nestedResult);
      }
    } else {
      // If the value is not an object, find matching questions
      const matchingQuestions = LegalTrainingATM.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === value.toLowerCase());
      
      matchingQuestions.forEach(matchingQuestion => {
        result.push(matchingQuestion.LegalTrainingMaterial + `\n`);
      });
    }
  };

  for (const key in userInputData) {
    await processValue(key, userInputData[key]);
  }

  return result;
}

