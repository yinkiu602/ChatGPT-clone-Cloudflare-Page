import OpenAI from "openai";

export async function onRequestPost(context) {
    const { env, request } = context;
    try {
        return fetchResponse(context);
    } catch (e) {
        return new Response(e.message, {
            status: 500,
            statusText: "Internal Server Error. Please resend the request.",
        });
    }
}

async function fetchResponse(context) {
    const {request, env} = context;
    const db = context.env.DB;
    const openai = new OpenAI({apiKey: env.API_KEY, baseURL: env.BASE_URL});
    const requestBody = await request.json();
    const chatId = requestBody.chatId;
    let inputPrompt = requestBody.prompt;
    let tokenizer_prompt = JSON.parse(JSON.stringify(requestBody));
    let res_msg = "";
    let { readable, writable } = new TransformStream();
    let writer = writable.getWriter();
    const textEncoder = new TextEncoder();
    if (env.TOKENIZER_URL && env.PROMPT_MAX_TOKEN) {
        tokenizer_prompt["max"] = env.PROMPT_MAX_TOKEN;
        const res = await fetch(env.TOKENIZER_URL, {
            method: "POST",
            headers: {"Content-Type": "application/json",},
            body: JSON.stringify(tokenizer_prompt),
        })
        if (res.ok) {
            const data = await res.json();
            inputPrompt = data;
        }
    }

    context.waitUntil((async () => {
        const stream = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: inputPrompt,
          stream: true,
          max_tokens: parseInt(env.REQUEST_MAX_TOKEN),
        });
        for await (const part of stream) {
            let temp = part.choices[0]?.delta?.content || '';
            res_msg += temp;
            writer.write(textEncoder.encode(temp));
        }
        writer.close();
        if (chatId) {
            const outputPrompt = tokenizer_prompt.concat([{ role: "assistant", content: res_msg }]);
            await db.prepare(`INSERT OR REPLACE INTO chat_history (_id, userId, title, messages, modified) VALUES ('${chatId}', '${context.data.user}', '${outputPrompt[0].content[0].text}', '${JSON.stringify(outputPrompt)}', ${Date.now()});`).run();
        }
    })());

    return new Response(readable);
}