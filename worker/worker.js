export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("target");
    if (!target) return new Response("Falta el parámetro ?target=URL", { status: 400 });
    if (!/^https?:\/\//i.test(target)) return new Response("Target inválido. Debe empezar por http(s)://", { status: 400 });

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Método no permitido.", { status: 405, headers: corsHeaders });

    const upstream = await fetch(target, { method: "GET", cf: { cacheTtl: 0, cacheEverything: false } });
    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
    headers.set("Cache-Control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers });
  }
};
