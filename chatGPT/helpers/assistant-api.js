import OpenAI from 'openai';
import fs from 'fs';
import { getThreadId, saveThreadId } from '../../Services/redis/redisWAThreads.js'

const openai = new OpenAI(process.env.OPENAI_API_KEY);

export async function interactWithAssistant(query, phoneNumber, ass_id) {
    if (query == '' || !query)
        return { response: { answer: '', question: '' } };
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
            console.error('error in create message', error);
        });

        return await runAssistant(threadId, ass_id);
    } catch (error) {
        console.error("Error interacting with Assistant:", error);
        return "Error: Unable to process the request";
    }
}


async function runAssistant(threadId, ass_id) {
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
}

export async function createAssistantThread() {

    const threadResponse = await openai.beta.threads.create();
    return threadResponse.id;

}

export async function deleteAssistantThread(threadId) {
    //const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const threadResponse = await openai.beta.threads.del(threadId);
    return threadResponse;
}

export async function sendFileToAssistant(filePath, threadId, ass_id) {
    try {
        // const openai = new OpenAI(process.env.OPENAI_API_KEY);
        // Step 1: Upload the file
        const file = fs.createReadStream(filePath);
        const uploadResponse = await openai.files.create({
            file,
            purpose: 'assistants',
        });

        console.log('File uploaded successfully:', uploadResponse.id);

        // Step 2: Send the file reference in a message
        const messageResponse = await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: "Attached document",
            attachments: [{ file_id: uploadResponse.id, tools: [{ type: "file_search" }] }],

        });

        console.log('Message with file sent successfully:', messageResponse);
        return await runAssistant(threadId, ass_id, uploadResponse.id);
    } catch (error) {
        console.error('Error uploading or sending file:', error.message);
    }
}

export async function deleteAssistantFile(fileId) {
    try {
        const deleteResponse = await openai.files.del(fileId);
        console.log('File deleted successfully:', deleteResponse);
    } catch (error) {
        console.error('Error deleting file:', error.message);
    }
}


