import OpenAI from 'openai';
import { prompts } from "./prompts.js"
import * as constants from '../constants.js';
import LegalTrainingATM from '../JSONs/LegalTrainingATM.json' assert {type: "json"};
import { processDocx } from '../CloudStorage/processDocs.js';
let message;
async function createMessageContent(prompttype, userInputData, threadId) {
  const legalTraining = await getLegalTrainingMaterials(userInputData);
  const userInputPara = await createUserInputParagraph(userInputData, threadId);
  message = [
    {
      "role": "system",
      "content": `${prompts[prompttype]}`
    },
    {
      "role": "user",
      "content": `${userInputPara}
${legalTraining} Generate a comprehensive, well-structured letter incorporating all the above elements, tailored to the specific details provided and aligned with the legal guidelines. The letter should be professional, convincing, and geared towards achieving a positive outcome.`
    }
  ]
  processDocx(message[0].content + '\n' + message[1].content, threadId, constants.USERINPUTFILENAME + prompttype);
  return message;
}
export async function createLetterwithFineTuned(prompttype, userInputData, threadId) {
  try {

    message = await createMessageContent(prompttype, userInputData, threadId);
    const FineTunedModelResponse = await openAiCompletionWithFineTunedATMBank(message);
    processDocx(JSON.stringify(FineTunedModelResponse, null, 2), threadId, constants.FINE_TUNED_RESPONSE_JSON + prompttype);
    processDocx(FineTunedModelResponse.choices[0].message.content, threadId, constants.GPT3_5_FINE_TUNED + prompttype);
    return ;
  }
  catch (error) {
    error
  }
}

export async function createLetterWithGPT3_5(prompttype, userInputData, threadId) {
  try {

    message = message!=null? message: await createMessageContent(prompttype, userInputData, threadId);
    const GPT3_5Response = await openAiCompletionWithGPT3_5(message);
    processDocx(JSON.stringify(GPT3_5Response, null, 2), threadId, constants.GPT3_5_RESPONSE_JSON + prompttype);
    processDocx(GPT3_5Response.choices[0].message.content, threadId, constants.GPT3_5 + prompttype);
    return ;
  }
  catch (error) {
    error
  }
}

export async function createUserInputParagraph(userInputData, threadId) {
  try {

    let userInputMessage = [
      {
        "role": "system",
        "content": `Your Job is to convert the given Json object in fact based paragraph  from the perspective of the victim which can be read by a LLM model`
      },
      {
        "role": "user",
        "content": `Given the following details about a financial fraud incident, generate a fact-based paragraph from the perspective of the me:
        ${JSON.stringify(userInputData, null, 2)}`
      }
    ];
    const GPT3_5Response = await openAiCompletionWithGPT3_5(userInputMessage);
    processDocx(JSON.stringify(GPT3_5Response, null, 2), threadId, constants.GPT3_5_RESPONSE_JSON + 'UserInputPara');
    return GPT3_5Response.choices[0].message.content;
  }
  catch (error) {
    error
  }
}
export async function createLetterWithGPT4(prompttype, userInputData, threadId) {
  try {

    message = message!=null? message: await createMessageContent(prompttype, userInputData, threadId);
    const GPT4Response = await openAiCompletionWithGPT4(message);
    processDocx(JSON.stringify(GPT4Response, null, 2), threadId, constants.GPT4_RESPONSE_JSON + prompttype);
    processDocx(GPT4Response.choices[0].message.content, threadId, constants.GPT4 + prompttype);
    return ;
  }
  catch (error) {
    error
  }
}

async function openAiCompletionWithFineTunedATMBank(message) {
  const openai = new OpenAI(process.env.OPENAI_API_KEY);
  //console.log("input to openAI", message);
  const completionResponse = await openai.chat.completions.create({
    model: "ft:gpt-3.5-turbo-0613:personal::8twTZDyP",
    messages: message,
    temperature: 0.5,
    max_tokens: 1500,
    n: 1,
    top_p: 1,
    frequency_penalty: 1.07,
    presence_penalty: 0,
  });
  return completionResponse;
}
async function openAiCompletionWithGPT3_5(message) {
  const openai = new OpenAI(process.env.OPENAI_API_KEY);
  const completionResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-0613",
    messages: message,
    temperature: 0.5,
    max_tokens: 1500,
    n: 1,
    top_p: 0.9,
    frequency_penalty: 0.2,
    presence_penalty: 0,
  });
  return completionResponse;
}
async function openAiCompletionWithGPT4(message) {
  const openai = new OpenAI(process.env.OPENAI_API_KEY);
  const completionResponse = await openai.chat.completions.create({
    model: "gpt-4-0125-preview",
    messages: message,
    temperature: 0.5,
    max_tokens: 1500,
    n: 1,
    top_p: 1,
    frequency_penalty: 1.07,
    presence_penalty: 0,
  });
 return completionResponse;
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
        result.push(matchingQuestion.LegalTrainingMaterial + `\n\n`);
      });
    }
  };

  for (const key in userInputData) {
    await processValue(key, userInputData[key]);
  }

  return result;
}

