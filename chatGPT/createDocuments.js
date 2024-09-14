import { createMessageContent, createUserInputParagraph, removeKeys } from "./helpers/buildInputData.js";
import { openAiChatCompletion } from "./helpers/openAI.js";
import { processDocx } from "../CloudStorage/processDocs.js";
import { getLegalTraining } from "./helpers/legalTraining.js"
import * as types from '../utils/types.js'


export async function createLetter(tag, letterOption, userInputData, legalTrainingData, sessionId, openAiConfig) {
    try {
        const promptType = tag + '_' + letterOption;
        const updatedUserData = await removeKeys(userInputData);
        const userInputPara = await createUserInputParagraph(updatedUserData, tag);
        const legalTraining = await getLegalTraining(userInputData, legalTrainingData, letterOption, tag);
        const message = await createMessageContent(promptType, userInputPara, legalTraining);
        const completionResponse = await openAiChatCompletion(message, openAiConfig.model, openAiConfig.temprature, openAiConfig.max_tokens, openAiConfig.n, openAiConfig.top_p, openAiConfig.frequency_penalty, openAiConfig.presence_penalty);
        await processDocx(completionResponse.choices[0].message.content, sessionId, sessionId + promptType);
        processDocx(JSON.stringify(updatedUserData,null,2) + '\n\n'+ message[0].content + '\n' + message[1].content, sessionId, sessionId + promptType + '_Input');
        return;
    } catch (error) {
        console.log(error);
    }
}

export async function createLetterWith4o(tag, letterOption, userInputData, legalTrainingData, sessionId, openAiConfig) {
    try {
        const promptType = tag + '_' + letterOption;
        const updatedUserData = await removeKeys(userInputData);
        const userInputPara = await createUserInputParagraph(updatedUserData, tag);
        const legalTraining = await getLegalTraining(userInputData, legalTrainingData, letterOption, tag);
        const message = await createMessageContent(promptType, userInputPara, legalTraining);
        //processDocx(JSON.stringify(updatedUserData,null,2) + '\n\n'+ message[0].content + '\n' + message[1].content, sessionId, sessionId + promptType + '_Input');
        const completionResponse = await openAiChatCompletion(message, types.openAIModels.GPT4o, openAiConfig.temprature, openAiConfig.max_tokens, openAiConfig.n, openAiConfig.top_p, openAiConfig.frequency_penalty, openAiConfig.presence_penalty);
        processDocx(completionResponse.choices[0].message.content, sessionId, sessionId + promptType + '_GPT4o');

        return;
    } catch (error) {
        console.log(error);
    }
}