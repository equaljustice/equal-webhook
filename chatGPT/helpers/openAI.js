import OpenAI from 'openai';


export async function openAiChatCompletion(message, model, temperature = 0.1, max_tokens=1500, n = 1, top_p = 1, frequency_penalty = 0, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const completionResponse = await openai.chat.completions.create({
        model: model,
        messages: message,
        temperature: temperature,
        max_tokens: max_tokens,
        n: n,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}

export async function openAiCompletion(message, model, temperature = 0.5, max_tokens, n = 1, top_p = 1, frequency_penalty = 0, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const completionResponse = await openai.completions.create({
        model: model,
        messages: message,
        temperature: temperature,
        max_tokens: max_tokens,
        n: n,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}