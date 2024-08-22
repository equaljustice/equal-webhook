import OpenAI from 'openai';


export async function interactWithAssistant(query, threadId, ass_id) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    try {
        if (!threadId || threadId == "") {
            
            // Create a Thread
            threadId = await createAssistantThread();
        }
        // Add a Message to a Thread
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: query,
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
        //console.log("assistantResponses[0]", JSON.stringify(assistantResponses[0]));
        const text = assistantResponses[0].content[0].text.value;
       // console.log("assistantResponses", JSON.stringify(assistantResponses, null, 2));
        // If there are no text responses, response will remain an empty string.
        var response = { text, threadId };
        return response;

    } catch (error) {
        console.error("Error interacting with Assistant:", error);
        return "Error: Unable to process the request";
    }
}

export async function createAssistantThread(){
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
       
    const threadResponse = await openai.beta.threads.create();
            return threadResponse.id;
       
}

export async function createThreadIfnoExist(){}