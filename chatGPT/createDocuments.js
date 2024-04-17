import { createMessageContent, createUserInputParagraph, removeKeys } from "./helpers/buildInputData.js";
import { openAiChatCompletion } from "./helpers/openAI.js";
import { processDocx } from "../CloudStorage/processDocs.js";
import { getLegalTraining } from "./helpers/legalTraining.js"


export async function createLetter(transactionType, letterOption, userInputData, legalTrainingData, sessionId, openAiConfig) {
    try {
        const promptType = transactionType + '_' + letterOption;
        const updatedUserData = await removeKeys(userInputData);
        const userInputPara = await createUserInputParagraph(updatedUserData, transactionType);
        const legalTraining = ["RTIApplication", "PoliceComplaint"].includes(letterOption) ? '' : await getLegalTraining(userInputData, legalTrainingData);
        const message = await createMessageContent(promptType, userInputPara, legalTraining);
        processDocx(JSON.stringify(updatedUserData,null,2) + '\n\n'+ message[0].content + '\n' + message[1].content, sessionId, sessionId + promptType + '_Input');
        const completionResponse = await openAiChatCompletion(message, openAiConfig.model, openAiConfig.temprature, openAiConfig.max_tokens, openAiConfig.n, openAiConfig.top_p, openAiConfig.frequency_penalty, openAiConfig.presence_penalty);
        processDocx(completionResponse.choices[0].message.content, sessionId, sessionId + promptType);

        return;
    } catch (error) {
        console.log(error);
    }
}