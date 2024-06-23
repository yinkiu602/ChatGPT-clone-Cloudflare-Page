export async function onRequestGet(context) {
    const { env, request } = context;
    return new Response(null, {
        status: 302,
        headers: {
            location: `https://discord.com/oauth2/authorize?client_id=${env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(request.headers.get("referer") + env.REDIRECT_URI)}&scope=identify&prompt=none`,
        },
    });
}