export async function onRequest(context) {
    const { request, next, env } = context;
    try {
        const cookie = request.headers.get("cookie") || "";
        const session_str = cookie.split("session_id=")[1];
        if (!session_str) {
            context.data.user = null;
            context.data.username = null;
            return await next();
        }
        const session_id = session_str.split(";")[0];
        if (session_id) {
            const user_id = await env.session.get(session_id);
            let username;
            if (user_id) {
                username = await env.session.get(user_id);
                context.data.user = user_id;
                context.data.username = username;
            }
        }
        return await next();
    } catch (err) {
        return new Response(`${err.message}\n${err.stack}`, { status: 500 });
    }
  }