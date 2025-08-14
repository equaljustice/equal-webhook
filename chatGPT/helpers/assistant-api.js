import OpenAI from 'openai';
import fs from 'fs';
import { updateSessionWithNewThread } from '../../Services/redis/redisWASession.js';
import { logger } from '../../utils/logging.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class CircuitBreaker {
    constructor(failureThreshold = 5, resetTimeout = 60000) {
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
        this.failures = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        
        logger.info(`CircuitBreaker initialized - Threshold: ${failureThreshold}, ResetTimeout: ${resetTimeout}ms`);
    }
    
    async execute(fn) {
        logger.debug(`CircuitBreaker state: ${this.state}, Failures: ${this.failures}`);
        
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                logger.info('CircuitBreaker transitioning from OPEN to HALF_OPEN');
                this.state = 'HALF_OPEN';
            } else {
                const remainingTime = this.resetTimeout - (Date.now() - this.lastFailureTime);
                logger.warn(`CircuitBreaker is OPEN. Remaining cooldown: ${Math.ceil(remainingTime/1000)}s`);
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            logger.debug('CircuitBreaker executing function');
            const result = await fn();
            this.onSuccess();
            logger.debug('CircuitBreaker function executed successfully');
            return result;
        } catch (error) {
            logger.error('CircuitBreaker function failed:', error);
            this.onFailure();
            throw error;
        }
    }
    
    onSuccess() {
        if (this.failures > 0) {
            logger.info(`CircuitBreaker reset - Failures reduced from ${this.failures} to 0`);
        }
        this.failures = 0;
        this.state = 'CLOSED';
    }
    
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        logger.warn(`CircuitBreaker failure #${this.failures}/${this.failureThreshold}`);
        
        if (this.failures >= this.failureThreshold) {
            logger.error(`CircuitBreaker threshold reached - State changed to OPEN`);
            this.state = 'OPEN';
        }
    }
}

const openAICircuitBreaker = new CircuitBreaker();

export async function interactWithAssistant(query, phoneNumber, ass_id, threadId) {
    logger.info(`Assistant interaction started - Phone: ${phoneNumber}, Thread: ${threadId}, Query length: ${query?.length || 0}`);
    
    if (query == '' || !query) {
        logger.warn('Empty query received for assistant interaction');
        return { response: { answer: 'Invalid input' } };
    }
    
    try {
        if (!threadId) {
            logger.info('Creating new assistant thread');
            threadId = await createAssistantThread();
            logger.info(`New thread created: ${threadId}`);
            updateSessionWithNewThread(phoneNumber, threadId);
        } else {
            logger.debug(`Using existing thread: ${threadId}`);
        }
        
        // Add a Message to a Thread
        logger.debug('Adding message to thread');
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: query,
        }).catch(async (error) => {
            logger.error('Error creating message in thread:', error);
        });

        logger.info('Starting assistant run');
        const result = await runAssistant(threadId, ass_id);
        logger.info('Assistant interaction completed successfully');
        return result;
        
    } catch (error) {
        logger.error("Error interacting with Assistant:", error);
        return "Error: Unable to process the request";
    }
}

async function runAssistant(threadId, ass_id) {
    logger.info(`Starting assistant run - Thread: ${threadId}, Assistant: ${ass_id}`);
    
    return openAICircuitBreaker.execute(async () => {
        const startTime = Date.now();
        
        logger.debug('Creating OpenAI run');
        const runResponse = await openai.beta.threads.runs.create(threadId, {
            assistant_id: ass_id,
        });
        logger.info(`OpenAI run created: ${runResponse.id}`);
        
        // ⚡ PERFORMANCE IMPROVEMENT: Add timeout to prevent WhatsApp webhook timeout
        const timeout = 20000; // 20 seconds max (WhatsApp limit)
        const maxPollingInterval = 1000; // ⚡ 1 second instead of 5 seconds
        
        logger.debug(`Starting run status polling - Timeout: ${timeout}ms, Polling interval: ${maxPollingInterval}ms`);
        
        let run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
        let pollCount = 0;
        
        while (run.status !== "completed" && (Date.now() - startTime) < timeout) {
            pollCount++;
            const elapsed = Date.now() - startTime;
            const remaining = timeout - elapsed;
            
            logger.debug(`Poll #${pollCount} - Status: ${run.status}, Elapsed: ${elapsed}ms, Remaining: ${remaining}ms`);
            
            await new Promise((resolve) => setTimeout(resolve, maxPollingInterval));
            run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
            
            // ⚡ ERROR HANDLING: Check for failed states
            if (run.status === "failed" || run.status === "cancelled") {
                const errorMsg = `OpenAI Assistant run ${run.status}: ${run.last_error?.message || 'Unknown error'}`;
                logger.error(errorMsg, { runId: runResponse.id, status: run.status, error: run.last_error });
                throw new Error(errorMsg);
            }
        }
        
        // ⚡ TIMEOUT PROTECTION: Prevent infinite waiting
        if (run.status !== "completed") {
            const totalTime = Date.now() - startTime;
            logger.error(`OpenAI Assistant timeout after ${totalTime}ms - Final status: ${run.status}`);
            throw new Error("OpenAI Assistant timeout - response took too long");
        }
        
        logger.info(`Run completed successfully in ${Date.now() - startTime}ms after ${pollCount} polls`);
        
        // Retrieve the Assistant's Response
        logger.debug('Retrieving assistant messages');
        const messagesResponse = await openai.beta.threads.messages.list(threadId);
        const assistantResponses = messagesResponse.data.filter(msg => msg.role === 'assistant');
        
        if (assistantResponses.length === 0) {
            logger.warn('No assistant responses found in thread');
            throw new Error('No response from assistant');
        }
        
        const response = { answer: assistantResponses[0].content[0].text.value };
        logger.info(`Assistant response retrieved - Length: ${response.answer.length} characters`);
        
        return response;
    });
}

export async function createAssistantThread() {
    logger.info('Creating new OpenAI assistant thread');
    try {
        const threadResponse = await openai.beta.threads.create();
        logger.info(`Assistant thread created successfully: ${threadResponse.id}`);
        return threadResponse.id;
    } catch (error) {
        logger.error('Error creating assistant thread:', error);
        throw error;
    }
}

export async function deleteAssistantThread(threadId) {
    logger.info(`Deleting assistant thread: ${threadId}`);
    try {
        const threadResponse = await openai.beta.threads.del(threadId);
        logger.info(`Assistant thread deleted successfully: ${threadId}`);
        return threadResponse;
    } catch (err) {
        logger.error(`Error deleting assistant thread ${threadId}:`, err);
        throw err;
    }
}

export async function sendFileToAssistant(filePath, threadId, ass_id) {
    logger.info(`Sending file to assistant - File: ${filePath}, Thread: ${threadId}, Assistant: ${ass_id}`);
    
    try {
        // Step 1: Upload the file
        logger.debug('Uploading file to OpenAI');
        const file = fs.createReadStream(filePath);
        const uploadResponse = await openai.files.create({
            file,
            purpose: 'assistants',
        });

        logger.info(`File uploaded successfully: ${uploadResponse.id}`);

        // Step 2: Send the file reference in a message
        logger.debug('Sending file reference in message');
        const messageResponse = await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: "Attached document",
            attachments: [{ file_id: uploadResponse.id, tools: [{ type: "file_search" }] }],
        });

        logger.info('Message with file sent successfully');
        return await runAssistant(threadId, ass_id, uploadResponse.id);
        
    } catch (error) {
        logger.error('Error uploading or sending file:', error);
        throw error;
    }
}

export async function deleteAssistantFile(fileId) {
    logger.info(`Deleting assistant file: ${fileId}`);
    try {
        const deleteResponse = await openai.files.del(fileId);
        logger.info(`File deleted successfully: ${fileId}`);
        return deleteResponse;
    } catch (error) {
        logger.error(`Error deleting file ${fileId}:`, error);
        throw error;
    }
}


