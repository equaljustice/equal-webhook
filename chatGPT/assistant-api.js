import OpenAI from 'openai';


export async function interactWithAssistant(query, threadId, ass_id) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    try {
        if (!threadId || threadId == "") {
            
            // Create a Thread
            const threadResponse = await openai.beta.threads.create();
            threadId = threadResponse.id;
        }
        // Add a Message to a Thread
        const message = await openai.beta.threads.messages.create(threadId, {
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
            await new Promise((resolve) => setTimeout(resolve, 1000));
            run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
        }
        // Retrieve the Assistant's Response
        const messagesResponse = await openai.beta.threads.messages.list(threadId);
        //const messagesResponse = await openai.beta.threads.messages.retrieve(
        //  threadId,
        //message.id
        //);
        const assistantResponses = messagesResponse.data.filter(msg => msg.role === 'assistant');
        //console.log("assistantResponses[0]", JSON.stringify(assistantResponses[0]));
        const response = assistantResponses[0].content[0].text.value;
        console.log("response", response);
        // If there are no text responses, response will remain an empty string.
        var return_data = { response, threadId };
        return return_data;

    } catch (error) {
        console.error("Error interacting with Assistant:", error);
        return "Error: Unable to process the request";
    }
}
