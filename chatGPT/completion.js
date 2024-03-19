import OpenAI from 'openai';
import { prompts } from "./prompts.js"
import * as constants from '../constants.js';
import LegalTrainingATM from '../JSONs/LegalTrainingATM.json' assert { type: "json" };
import RBI_laws_failed_txn from '../JSONs/RBI_laws_failed_txn.json' assert { type: "json" };
import { processDocx } from '../CloudStorage/processDocs.js';
export async function createMessageContent(prompttype, userInputData, threadId) {
  
    const legalTraining = ["RTI", "PoliceComplaint"].includes(prompttype) ? '' : await getLegalTrainingMaterials(userInputData);
    
    const userInputPara = await createUserInputParagraph(userInputData, threadId);
    const message = [{
            "role": "system",
            "content": `${prompts[prompttype]}`
        },
        {
            "role": "user",
            "content": `User's inputs and response is given below:
      ${userInputPara}
      
      ${legalTraining}`
        }
    ]
   
    processDocx(message[0].content + '\n' + message[1].content, threadId, threadId + constants.USERINPUTFILENAME + prompttype);
    return message;
}
export async function createMessageContentFailed_txn(prompttype, userInputData, threadId) {
  console.log("2");
  const legalTraining = ["RTI", "PoliceComplaint"].includes(prompttype) ? '' : await getLegalTrainingMaterialsFailed_txn(userInputData);
  console.log("4");
  const userInputPara = await createUserInputParagraph(userInputData, threadId);
  console.log("6");
  const message = [{
          "role": "system",
          "content": `${prompts[prompttype]}`
      },
      {
          "role": "user",
          "content": `User's inputs and response is given below:
    ${userInputPara}
    
    ${legalTraining}`
      }
  ]
  console.log("7");
  processDocx(message[0].content + '\n' + message[1].content, threadId, threadId + constants.USERINPUTFILENAME + prompttype);
  return message;
}
export async function createBankLetterwithFineTuned(prompttype, userInputData, threadId) {
    try {
        const message = await createMessageContent(prompttype, userInputData, threadId);
        const  FineTunedModelResponse = await openAiCompletionWithFineTunedATMBank(message);
        processDocx(FineTunedModelResponse.choices[0].message.content, threadId, threadId + constants.GPT3_5_FINE_TUNED + prompttype);
        // processDocx(JSON.stringify(FineTunedModelResponse, null, 2), threadId, threadId+constants.FINE_TUNED_RESPONSE_JSON + prompttype);
        return;
    } catch (error) {
            error;
}
}
export async function createBankLetterwithFineTunedFailedtxnbank(prompttype, userInputData, threadId) {
    try { console.log("1");
        const message = await createMessageContentFailed_txn(prompttype, userInputData, threadId);
        const  FineTunedModelResponse = await openAiCompletionWithFineTunedATMBank(message);
        processDocx(FineTunedModelResponse.choices[0].message.content, threadId, threadId + constants.GPT3_5_FINE_TUNED + prompttype);
        // processDocx(JSON.stringify(FineTunedModelResponse, null, 2), threadId, threadId+constants.FINE_TUNED_RESPONSE_JSON + prompttype);
        return;
    } catch (error) {
            error;
}
}
export async function createOmbudsmanLetterwithFineTunedFailedtxnOmbudsman(prompttype, userInputData, threadId) {
    try {
       
        const message = await createMessageContentFailed_txn(prompttype, userInputData, threadId);
        const FineTunedModelResponse = await openAiCompletionWithFineTunedFailedtxnBankOmbudsman(message);
        processDocx(FineTunedModelResponse.choices[0].message.content, threadId, threadId + constants.GPT3_5_FINE_TUNED + prompttype);
        // processDocx(JSON.stringify(FineTunedModelResponse, null, 2), threadId, threadId+constants.FINE_TUNED_RESPONSE_JSON + prompttype);

        return;
    } catch (error) {
        error
    }
}
export async function createOmbudsmanLetterwithFineTuned(prompttype, userInputData, threadId) {
    try {

        const message = await createMessageContent(prompttype, userInputData, threadId);
        const FineTunedModelResponse = await openAiCompletionWithFineTunedATMBankOmbudsman(message);
        processDocx(FineTunedModelResponse.choices[0].message.content, threadId, threadId + constants.GPT3_5_FINE_TUNED + prompttype);
        // processDocx(JSON.stringify(FineTunedModelResponse, null, 2), threadId, threadId+constants.FINE_TUNED_RESPONSE_JSON + prompttype);

        return;
    } catch (error) {
        error
    }
}
export async function createConsumerCourtLetterwithFineTuned(prompttype, userInputData, threadId) {
    try {

        const message = await createMessageContent(prompttype, userInputData, threadId);
        const FineTunedModelResponse = await openAiCompletionWithFineTuneBankOmbudsmanCommon(message);
        processDocx(FineTunedModelResponse.choices[0].message.content, threadId, threadId + constants.GPT3_5_FINE_TUNED + prompttype);
        // processDocx(JSON.stringify(FineTunedModelResponse, null, 2), threadId, threadId+constants.FINE_TUNED_RESPONSE_JSON + prompttype);

        return;
    } catch (error) {
        error
    }
}

export async function createLetterWithGPT3_5(prompttype, userInputData, threadId) {
    try {

        const message = await createMessageContent(prompttype, userInputData, threadId);
        const GPT3_5Response = await openAiCompletionWithGPT3_5(message);
        // processDocx(JSON.stringify(GPT3_5Response, null, 2), threadId, threadId+constants.GPT3_5_RESPONSE_JSON + prompttype);
        processDocx(GPT3_5Response.choices[0].message.content, threadId, threadId + constants.GPT3_5 + prompttype);
        return;
    } catch (error) {
        error
    }
}
export async function createLetterWithGPT3_5_Failed_txn(prompttype, userInputData, threadId) {
    try {

        const message = await createMessageContentFailed_txn(prompttype, userInputData, threadId);
        const GPT3_5Response = await openAiCompletionWithGPT3_5(message);
        // processDocx(JSON.stringify(GPT3_5Response, null, 2), threadId, threadId+constants.GPT3_5_RESPONSE_JSON + prompttype);
        processDocx(GPT3_5Response.choices[0].message.content, threadId, threadId + constants.GPT3_5 + prompttype);
        return;
    } catch (error) {
        error
    }
}

export async function createUserInputParagraph(userInputData, threadId) {
    try {
      console.log("5");
        let updatedUserData = await removeKeys(userInputData);
        let userInputMessage = [{
                "role": "system",
                "content": "Your Job is to convert the given Json objects in a simple textual paragraph without sounding like a storyboard"
            },
            {
                "role": "user",
                "content": `Here is the JSON data related to financeial fraud happend to me. All the transaction amounts are in rupees describe this in simple english language not more than 200 words,
        ${JSON.stringify(updatedUserData, null, 2)}`
            }
        ];
        /* console.log(`JSON: ${JSON.stringify(userInputData, null, 2)}
        JsonAfterRemovedKeys: ${JSON.stringify(updatedUserData, null, 2)})`); */
        const GPT4Response = await openAiCompletionWithGPT4(userInputMessage, 1, 1);
        /*  processDocx(`JSON: ${JSON.stringify(userInputData, null, 2)}
           JsonAfterRemovedKeys: ${JSON.stringify(updatedUserData, null, 2)}
           Paragraph: ${JSON.stringify(GPT4Response, null, 2)}`, threadId, threadId + constants.GPT4_RESPONSE_JSON + 'UserInputPara'); */
        return GPT4Response.choices[0].message.content;
    } catch (error) {
        error
    }
}

async function removeKeys(jsonData) {
    let cleanedJson = JSON.parse(JSON.stringify(jsonData)); // Create a deep copy of the json
    (function _clean(obj) {
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    obj[index] = _clean(item);
                });
            } else {
                Object.keys(obj).forEach(key => {
                    if (obj[key] && typeof obj[key] === 'object') {
                        obj[key] = _clean(obj[key]); // Recurse if the value is an object
                    } else if (['Senior_citizen', 'pension_savings_account', 'lost_atm',
                            'withdrawn_amount_exceed_daily_limit', 'prior_police_complaint',
                            'transaction_happen_after_informed_bank_of_previous_fraud'
                        ]
                        .includes(key) && String(obj[key]).toLowerCase() === 'no') {
                        delete obj[key];
                    } else if (['applied_for_atmcard', 'withdrawing_regularly_from_atm',
                            'refund_compensesion_expected',
                            'transaction_sms_recieved', 'transaction_sms_recieved_within_one_hour',
                            'transaction_email_recieved', 'transaction_email_recieved_within_one_hour',
                            'transaction_from_ATM_in_home_city_or_work_city',
                            'transaction_from_ATM_in_home_city_or_work_city_regularly_withdrawing'
                        ]
                        .includes(key) && String(obj[key]).toLowerCase() === 'yes') {
                        delete obj[key]; // Delete the key if the value is 'yes' 
                    } else if (key === 'area_of_user' && String(obj[key]).toLowerCase() === 'urban') { delete obj[key]; }
                });
            }
        }
        return obj;
    })(cleanedJson);
    return cleanedJson;
}

export async function createLetterWithGPT4(prompttype, userInputData, threadId) {
    try {

        const message = await createMessageContent(prompttype, userInputData, threadId);
        const GPT4Response = await openAiCompletionWithGPT4(message);
        // processDocx(JSON.stringify(GPT4Response, null, 2), threadId, threadId+constants.GPT4_RESPONSE_JSON + prompttype);
        processDocx(GPT4Response.choices[0].message.content, threadId, threadId + constants.GPT4 + prompttype);
        return;
    } catch (error) {
        error
    }
}

async function openAiCompletionWithFineTunedATMBank(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    console.log("here");
    //console.log("input to openAI", message);
    const completionResponse = await openai.chat.completions.create({
        model: "ft:gpt-3.5-turbo-1106:ashish-chandra:bankatmletter:90dP3i8f",
        messages: message,
        temperature: temperature,
        max_tokens: 1500,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}
async function openAiCompletionWithFineTunedATMBankOmbudsman(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    //console.log("input to openAI", message);
    const completionResponse = await openai.chat.completions.create({
        model: "ft:gpt-3.5-turbo-1106:ashish-chandra:atmombudsman:8zov1AhH",
        messages: message,
        temperature: temperature,
        max_tokens: 1500,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}
async function openAiCompletionWithFineTunedFailedtxnBankOmbudsman(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    //console.log("input to openAI", message);
    const completionResponse = await openai.chat.completions.create({
        model: "ft:gpt-3.5-turbo-1106:ashish-chandra:atmombudsman:8zov1AhH",
        messages: message,
        temperature: temperature,
        max_tokens: 1500,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}
async function openAiCompletionWithFineTuneBankOmbudsmanCommon(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    //console.log("input to openAI", message);
    const completionResponse = await openai.chat.completions.create({
        model: "ft:gpt-3.5-turbo-1106:ashish-chandra:bnkltrandobdsuman:90dcJiEd",
        messages: message,
        temperature: temperature,
        max_tokens: 1500,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}

async function openAiCompletionWithGPT3_5(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const completionResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: message,
        temperature: temperature,
        max_tokens: 1500,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}
async function openAiCompletionWithGPT4(message, temperature = 0.5, top_p = 1, frequency_penalty = 1.07, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const completionResponse = await openai.chat.completions.create({
        model: "gpt-4-0125-preview",
        messages: message,
        temperature: temperature,
        max_tokens: 1500,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}
async function openAiCompletionWithFineTunedFailedtxnBank(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    //console.log("input to openAI", message);
    const completionResponse = await openai.chat.completions.create({
        model: "ft:gpt-3.5-turbo-1106:ashish-chandra:bankatmletter:90dP3i8f",
        messages: message,
        temperature: temperature,
        max_tokens: 1500,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}

async function openAiCompletionWithFineTuneFailedBankOmbudsmanCommon(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    //console.log("input to openAI", message);
    const completionResponse = await openai.chat.completions.create({
        model: "ft:gpt-3.5-turbo-1106:ashish-chandra:bnkltrandobdsuman:90dcJiEd",
        messages: message,
        temperature: temperature,
        max_tokens: 1500,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}
async function getLegalTrainingMaterials(userInputData,promttype) {
    const result = [];
    
    const processValue = async(key, value) => {
        if (typeof value === 'object') {
         
            // If the value is an object (either JSON object or array), process recursively
            for (const key in value) {
                const nestedResult = await getLegalTrainingMaterials(value[key]);
                result.push(...nestedResult);
            }
        } else {
            // If the value is not an object, find matching questions
            console.log("here");
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

async function getLegalTrainingMaterialsFailed_txn(userInputData,promttype) {
    const result = [];
    
    const processValue = async(key, value) => {
        if (typeof value === 'object') {
         
            // If the value is an object (either JSON object or array), process recursively
            for (const key in value) {
                const nestedResult = await getLegalTrainingMaterialsFailed_txn(value[key]);
                result.push(...nestedResult);
            }
        } else {
            // If the value is not an object, find matching questions
            console.log(key);
            console.log(value);
            const matchingQuestions = RBI_laws_failed_txn.filter(item => item.Parameters.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === value.toLowerCase());
            //console.log(Parameters.toLowerCase());
            //console.log(key.toLowerCase());
            //console.log(Condition.toLowerCase());
            //console.log(value.toLowerCase());

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