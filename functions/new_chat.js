export async function onRequestGet(context) {
    const { request, env } = context;
    if (context.data.user) {
        try {
            const db = context.env.DB;
            const chat_id = crypto.randomUUID();
            return new Response(JSON.stringify({ id: chat_id}), { headers: { "content-type": "application/json" } });
        }
        catch (e) {
            console.log(e);
            new Response(e, {
                status: 500,
                statusText: "Internal Server Error. Please resend the request.",
            });
        }
    }
    else {
        return new Response(JSON.stringify({id: ""}), { headers: { "content-type": "application/json" } });
    
    }

}