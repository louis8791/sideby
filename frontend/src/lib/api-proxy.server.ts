type RuntimeEnvironment = Record<string, unknown>;

function configuredOrigin(env: unknown): string | undefined {
  const runtime = env && typeof env === "object" ? env as RuntimeEnvironment : {};
  const processValue = typeof process === "undefined" ? undefined : process.env["SIDEBY_API_ORIGIN"];
  const value = runtime["SIDEBY_API_ORIGIN"] ?? processValue;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeApiOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" || (url.protocol === "http:" && local) ? url : null;
  } catch {
    return null;
  }
}

export async function proxySidebyApi(request: Request, env: unknown): Promise<Response | null> {
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith("/api/")) return null;

  const configured = configuredOrigin(env);
  const apiOrigin = configured ? safeApiOrigin(configured) : null;
  if (!apiOrigin) {
    return Response.json({ error: { code: "API_ORIGIN_UNAVAILABLE" } }, { status: 503 });
  }

  const browserOrigin = request.headers.get("origin");
  if (browserOrigin) {
    try {
      if (new URL(browserOrigin).host.toLowerCase() !== incoming.host.toLowerCase()) {
        return Response.json({ error: { code: "ORIGIN_DENIED" } }, { status: 403 });
      }
    } catch {
      return Response.json({ error: { code: "ORIGIN_DENIED" } }, { status: 403 });
    }
  }

  const target = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1));
  if (browserOrigin) headers.set("origin", apiOrigin.origin);

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    ...(body === undefined ? {} : { body }),
  };
  let response: Response;
  try {
    response = await fetch(target, init);
  } catch {
    return Response.json({ error: { code: "API_UNAVAILABLE" } }, { status: 503 });
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
