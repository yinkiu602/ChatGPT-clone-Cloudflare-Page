export async function onRequestGet(context) {
    return new Response(context.data.username);
}