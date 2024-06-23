const COOKIE_TTL = 60 * 60 * 24 * 7; 

export async function onRequestGet(context) {
    const { env, request } = context;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) { return new Response.redirect("/login"); }
    try {
        const token = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: env.CLIENT_ID,
                client_secret: env.CLIENT_SECRET,
                code: code,
                grant_type: "authorization_code",
                redirect_uri: ("https://" + request.headers.get("host") + "/" + env.REDIRECT_URI),
                scope: "identify",
            }),
        })
        const json = await token.json();
        console.log(json);
        const data = await fetch(`https://discord.com/api/users/@me`, {headers: { Authorization: `Bearer ${json.access_token}` } });
        const user = await data.json();
        console.log(user.id);
        const session_id = crypto.randomUUID();
        await env.session.put(session_id, user.id, {expirationTtl: COOKIE_TTL});
        await env.session.put(user.id, user.username);
        return new Response(null, {
            status: 302,
            headers: {
                "Set-Cookie": `session_id=${session_id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_TTL}`,
                location: "/",
            },
        });
    }
    catch (e) {
        console.log(e);
        return new Response(e.message, {
            status: 302,
            statusText: "Failed",
            headers: {
                location: "/login",
            },
        });
    }
}