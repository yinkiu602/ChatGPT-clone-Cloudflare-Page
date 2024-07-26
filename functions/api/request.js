import OpenAI from "openai";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

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
    const country = request.cf.country;
    const ip = request.headers.get("CF-Connecting-IP")
    const host = request.headers.get("host");
    let { readable, writable } = new TransformStream();
    let writer = writable.getWriter();
    let openai;

    if (country === "HK" || country === "CN") {
        openai = new OpenAI({apiKey: env.API_KEY, baseURL: env.BASE_URL});
    }
    else {
        openai = new OpenAI({apiKey: env.API_KEY});
    }
    const requestBody = await request.json();
    const chatId = requestBody.chatId;
    const loggedin_ratelimit = new Ratelimit({
        redis: Redis.fromEnv(env),
        limiter: Ratelimit.slidingWindow(40, "3 h"),
        analytics: true,
    });
    const unlogged_ratelimit = new Ratelimit({
        redis: Redis.fromEnv(env),
        limiter: Ratelimit.slidingWindow(10, "3 h"),
        analytics: true,
    });
    let inputPrompt = requestBody.prompt;
    let backupPrompt = JSON.parse(JSON.stringify(inputPrompt));
    let res_msg = "";
    const textEncoder = new TextEncoder();

    if (env.TOKENIZER_URL && env.PROMPT_MAX_TOKEN) {
        let tokenizer_prompt = JSON.parse(JSON.stringify(requestBody));
        tokenizer_prompt["max"] = env.PROMPT_MAX_TOKEN;
        const res = await fetch(env.TOKENIZER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-forwarded-for": ip,
            },
            body: JSON.stringify(tokenizer_prompt),
        })
        if (res.ok) {
            const data = await res.json();
            inputPrompt = data;
        }
    }

    context.waitUntil((async () => {
        // Verify if needed turnstile token & token provided
        if (host === "chatgpt-clone-cloudflare-page.pages.dev") {
            const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                body: JSON.stringify({
                    secret: env.TURNSTILE_KEY,
                    response: requestBody.token,
                    remoteip: ip
                }),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            const result_json = await result.json()
            if (!result_json.success) {
                writer.write(textEncoder.encode("Please wait for a while before sending request. Recaptcha verification failed."));
                writer.close();
                return;
            }
        }
        
        let rate_limit_result = "";
        if (context.data.user) {
            rate_limit_result = (await loggedin_ratelimit.limit(context.data.user)).success;
        }
        else {
            rate_limit_result = (await unlogged_ratelimit.limit(ip)).success;
        }
        if (!rate_limit_result) {
            writer.write(textEncoder.encode("Rate Limit Exceeded"));
            writer.close();
            return;
        }

        const stream = await openai.chat.completions.create({
          model: (context.data.user? 'gpt-4o': 'gpt-4o-mini') ,
          messages: inputPrompt,
          stream: true,
          max_tokens: parseInt(env.REQUEST_MAX_TOKEN),
          user: (context.data.user || ip ),
        });
        for await (const part of stream) {
            let temp = part.choices[0]?.delta?.content || '';
            res_msg += temp;
            writer.write(textEncoder.encode(temp));
        }
        if (chatId) {
            let user_prompt = (backupPrompt[backupPrompt.length - 1].content[0].text).replace(/\'/g, "\'\'");
            res_msg = res_msg.replace(/\'/g, "\'\'");
            backupPrompt[backupPrompt.length - 1].content[0].text = user_prompt;
            const outputPrompt = backupPrompt.concat([{ role: "assistant", content: res_msg }]);
            const lastMessage = [backupPrompt[backupPrompt.length - 1]].concat([{ role: "assistant", content: res_msg }]);
            const result = await db.prepare(`SELECT EXISTS(SELECT _id FROM chat_history WHERE _id='${chatId}' AND userId='${context.data.user}') AS result;`).first("result");
            if (result === 0) {
                await db.prepare(`INSERT OR IGNORE INTO chat_history (_id, userId, title, messages, modified) VALUES ('${chatId}', '${context.data.user}', '${outputPrompt[0].content[0].text}', '${JSON.stringify(outputPrompt)}', ${Date.now()});`).run();
            }
            else {
                db.prepare(`UPDATE chat_history SET messages=SUBSTR(messages, 1, LENGTH(messages)-1) || '${"," + (JSON.stringify(lastMessage)).substring(1)}', modified=${Date.now()} WHERE _id='${chatId}' AND userId='${context.data.user}';`).run();
            }
            //await db.prepare(`INSERT OR REPLACE INTO chat_history (_id, userId, title, messages, modified) VALUES ('${chatId}', '${context.data.user}', '${outputPrompt[0].content[0].text}', '${JSON.stringify(outputPrompt)}', ${Date.now()});`).run();
        }
        writer.close();
    })());

    return new Response(readable);
}