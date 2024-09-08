import OpenAI from 'openai';
import { getThreadId, saveThreadId } from '../../Services/redis/redisWAThreads.js'

export async function interactWithAssistant(query, phoneNumber, ass_id) {
    if (query == '' || !query)
        return { response: { answer: '', question: '' } };
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    try {
        let threadId = await getThreadId(phoneNumber);
        if (!threadId) {
            // Create a Thread
            threadId = await createAssistantThread();
            saveThreadId(phoneNumber, threadId);
        }
        // Add a Message to a Thread
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: query,
        }).catch(async (error) => {
            console.error('Creating new Thread', error);
            threadId = await createAssistantThread();
        });

        // Run the Assistant
        const runResponse = await openai.beta.threads.runs.create(threadId, {
            assistant_id: ass_id, //assistantResponse.id
        });

        // Check the Run status and retrieve the response
        let run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
        while (run.status !== "completed") {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
        }
        // Retrieve the Assistant's Response
        const messagesResponse = await openai.beta.threads.messages.list(threadId);

        const assistantResponses = messagesResponse.data.filter(msg => msg.role === 'assistant');
            var response = { answer: assistantResponses[0].content[0].text.value };
            return response;
        
    } catch (error) {
        console.error("Error interacting with Assistant:", error);
        return "Error: Unable to process the request";
    }
}

export async function createAssistantThread() {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const threadResponse = await openai.beta.threads.create();
    return threadResponse.id;

}

export async function deleteAssistantThread(threadId) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const threadResponse = await openai.beta.threads.del(threadId);
    return threadResponse;
}