import { createMessageContent, createUserInputParagraph, removeKeys } from "./helpers/buildInputData.js";
import { openAiChatCompletion } from "./helpers/openAI.js";
import { processDocx } from "../CloudStorage/processDocs.js";
import { getLegalTraining } from "./helpers/legalTraining.js";
import { logger } from "../utils/logging.js";


export async function createLetter(tag, letterOption, userInputData, legalTrainingData, sessionId, openAiConfig, fileName) {
    const startTime = Date.now();
    
    logger.info('Starting letter creation process', {
        tag: tag,
        letterOption: letterOption,
        sessionId: sessionId,
        fileName: fileName,
        userInputDataKeys: userInputData ? Object.keys(userInputData).length : 0,
        hasLegalTrainingData: !!legalTrainingData,
        openAiModel: openAiConfig?.model,
        timestamp: new Date().toISOString()
    });

    try {
        const promptType = tag + '_' + letterOption;
        logger.debug('Letter creation parameters set', {
            promptType: promptType,
            tag: tag,
            letterOption: letterOption,
            sessionId: sessionId
        });

        // ⚡ DATA PROCESSING: Remove sensitive keys
        logger.debug('Starting user data processing', { sessionId: sessionId });
        const updatedUserData = await removeKeys(userInputData);
        logger.debug('User data keys removed', {
            originalKeys: userInputData ? Object.keys(userInputData).length : 0,
            updatedKeys: updatedUserData ? Object.keys(updatedUserData).length : 0,
            sessionId: sessionId
        });

        // ⚡ INPUT FORMATTING: Create structured paragraph
        logger.debug('Creating user input paragraph', { sessionId: sessionId, tag: tag });
        const orderedUserInput = await createUserInputParagraph(updatedUserData, tag);
        logger.info('User input paragraph created', {
            sessionId: sessionId,
            paragraphLength: orderedUserInput?.paragraph?.length || 0,
            hasReorderedData: !!orderedUserInput?.reorderedUserData,
            reorderedDataKeys: orderedUserInput?.reorderedUserData ? Object.keys(orderedUserInput.reorderedUserData).length : 0
        });

        // ⚡ LEGAL TRAINING: Get relevant legal context
        logger.debug('Getting legal training data', {
            sessionId: sessionId,
            letterOption: letterOption,
            tag: tag
        });
        const legalTraining = await getLegalTraining(orderedUserInput.reorderedUserData, legalTrainingData, letterOption, tag);
        logger.info('Legal training data retrieved', {
            sessionId: sessionId,
            legalTrainingLength: legalTraining?.length || 0,
            hasLegalTraining: !!legalTraining
        });

        // ⚡ MESSAGE CREATION: Build OpenAI prompt
        logger.debug('Creating message content for OpenAI', {
            promptType: promptType,
            sessionId: sessionId,
            paragraphLength: orderedUserInput?.paragraph?.length || 0,
            legalTrainingLength: legalTraining?.length || 0
        });
        const message = await createMessageContent(promptType, orderedUserInput.paragraph, legalTraining);
        logger.info('Message content created for OpenAI', {
            sessionId: sessionId,
            messageLength: Array.isArray(message) ? message.length : 0,
            totalContentLength: Array.isArray(message) ? message.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) : 0
        });

        // ⚡ OPENAI COMPLETION: Generate document content
        logger.info('Starting OpenAI completion', {
            sessionId: sessionId,
            model: openAiConfig.model,
            temperature: openAiConfig.temperature,
            maxTokens: openAiConfig.max_tokens,
            messageCount: Array.isArray(message) ? message.length : 0
        });
        
        const completionResponse = await openAiChatCompletion(
            message, 
            openAiConfig.model, 
            openAiConfig.temperature, 
            openAiConfig.max_tokens, 
            openAiConfig.n, 
            openAiConfig.top_p, 
            openAiConfig.frequency_penalty, 
            openAiConfig.presence_penalty
        );
        
        const generatedContent = completionResponse.choices[0].message.content;
        const cleanedContent = generatedContent.replaceAll('**', '');
        
        logger.info('OpenAI completion successful', {
            sessionId: sessionId,
            generatedContentLength: generatedContent?.length || 0,
            cleanedContentLength: cleanedContent?.length || 0,
            choicesCount: completionResponse.choices?.length || 0,
            model: completionResponse.model,
            usage: completionResponse.usage
        });

        // ⚡ DOCUMENT CREATION: Process main document
        logger.info('Creating main document', {
            sessionId: sessionId,
            fileName: fileName,
            contentLength: cleanedContent.length,
            folder: sessionId
        });
        
        const mainDocUrl = await processDocx(cleanedContent, sessionId, fileName);
        
        logger.info('Main document created successfully', {
            sessionId: sessionId,
            fileName: fileName,
            documentUrl: mainDocUrl,
            contentLength: cleanedContent.length
        });

        // ⚡ INPUT DOCUMENT: Create input documentation
        const inputContent = JSON.stringify(orderedUserInput.reorderedUserData, null, 2) + 
                           '\n\n' + message[0].content + '\n' + message[1].content;
        const inputFileName = fileName + '_Input';
        
        logger.debug('Creating input documentation', {
            sessionId: sessionId,
            inputFileName: inputFileName,
            inputContentLength: inputContent.length
        });
        
        const inputDocUrl = await processDocx(inputContent, sessionId, inputFileName);
        
        logger.info('Input documentation created successfully', {
            sessionId: sessionId,
            inputFileName: inputFileName,
            inputDocumentUrl: inputDocUrl,
            inputContentLength: inputContent.length
        });

        const totalTime = Date.now() - startTime;
        logger.info('Letter creation process completed successfully', {
            sessionId: sessionId,
            fileName: fileName,
            tag: tag,
            letterOption: letterOption,
            totalTimeMs: totalTime,
            mainDocumentUrl: mainDocUrl,
            inputDocumentUrl: inputDocUrl,
            generatedContentLength: cleanedContent.length,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            mainDocumentUrl: mainDocUrl,
            inputDocumentUrl: inputDocUrl,
            processingTime: totalTime
        };

    } catch (error) {
        const totalTime = Date.now() - startTime;
        
        logger.error('Letter creation process failed', {
            sessionId: sessionId,
            fileName: fileName,
            tag: tag,
            letterOption: letterOption,
            error: error.message,
            stack: error.stack,
            errorType: error.constructor.name,
            totalTimeMs: totalTime,
            timestamp: new Date().toISOString(),
            openAiConfig: {
                model: openAiConfig?.model,
                temperature: openAiConfig?.temperature,
                maxTokens: openAiConfig?.max_tokens
            }
        });
        
        // Re-throw the error so calling code can handle it appropriately
        throw new Error(`Letter creation failed: ${error.message}`);
    }
}