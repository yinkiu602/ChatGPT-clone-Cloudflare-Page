export async function onRequestGet(context) {
    if (context.data.user) {
        try {
            const db = context.env.DB;
            let output = [];
            const docs = await db.prepare(`SELECT * FROM chat_history WHERE userId = ${context.data.user} ORDER BY modified DESC`).all();
            console.log(docs.results[0]);
            for (const i of docs.results) {
                output.push({ id: i._id, title: i.title });
            }
            return new Response(JSON.stringify(output), { headers: { "content-type": "application/json" } });
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
        return new Response(JSON.stringify([]), { headers: { "content-type": "application/json" } });
    
    }

}