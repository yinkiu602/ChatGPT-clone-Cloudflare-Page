export async function onRequestGet(context) {
    if (context.data.user) {
        try {
            const db = context.env.DB;
            let doc = await db.prepare(`SELECT * FROM chat_history WHERE userId = '${context.data.user}' AND _id = '${context.params.id}'`).first();
            if (doc) {
                doc.messages = JSON.parse(doc.messages);
                return new Response(JSON.stringify(doc), { headers: { "content-type": "application/json; charset=utf-8" } });
            }
            else {
                return new Response(null, { status: 404, statusText: "Not Found" });
            }
        }
        catch (e) {
            console.log(e);
            return new Response(e, {
                status: 500,
                statusText: "Internal Server Error. Please resend the request.",
            });
        }
    }
    else {
        return new Response(e, {
            status: 403,
            statusText: "Forbidden",
        });
    }
}

export async function onRequestDelete(context) {
    if (context.data.user) {
        try {
            const db = context.env.DB;
            let doc = await db.prepare(`DELETE FROM chat_history WHERE userId = '${context.data.user}' AND _id = '${context.params.id}'`).first();
            return new Response(null, { status: 200 });
        }
        catch (e) {
            console.log(e);
            return new Response(e, {
                status: 500,
                statusText: "Internal Server Error. Please resend the request.",
            });
        }
    }
    else {
        return new Response(e, {
            status: 403,
            statusText: "Forbidden",
        });
    }
}