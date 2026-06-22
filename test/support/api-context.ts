// Synthetic APIContext factory for direct-invocation handler tests.
//
// The `/api/generate` and `/api/cards` handlers read only a thin slice of the Astro context:
//   - context.locals.user                          (the auth gate)
//   - context.request.headers.get("content-length") (the 413 cap)
//   - context.request.json()                        (the body)
//   - context.cookies                               (cards only, passed straight into createClient)
//   - context.params.id                             ([id].ts PATCH/DELETE route params)
//   - context.url.searchParams                      (GET /api/cards reads the `offset` query param)
//
// We build `request` as a plain object — NOT a real `Request` — because undici recomputes the
// `content-length` header from the actual body on a real Request, which would defeat the 413 test
// that needs to assert an arbitrary oversized content-length without buffering a huge body.
//
// This stand-in is intentionally minimal: it implements only the members the handlers read today
// (headers, json). If a handler starts reading `request.text()`, `request.body`, `request.url`, or
// `request.method`, EXTEND this factory — otherwise the missing member returns undefined and a test
// could pass against behavior that breaks in the real Astro/workerd runtime (the e2e suite is the
// real-runtime cross-check).
import type { APIContext } from "astro";

interface ApiContextOptions {
  /** context.locals.user — pass null to exercise the 401 gate. Defaults to a valid user. */
  user?: { id: string } | null;
  /** Resolved value of context.request.json(). Ignored when jsonThrows is true. */
  body?: unknown;
  /** When true, request.json() rejects — exercises the invalid-JSON 400 path. */
  jsonThrows?: boolean;
  /** Extra request headers. */
  headers?: Record<string, string>;
  /** Sets the content-length header (number or string). Omit to leave it absent. */
  contentLength?: number | string;
  /** context.params — route params for dynamic routes (e.g. `[id].ts` reads params.id). Defaults to {}. */
  params?: Record<string, string | undefined>;
  /** context.url — built as a real URL. Defaults to a benign placeholder. */
  url?: string;
  /** Convenience: query params merged onto the default URL (e.g. { offset: "100" }). Ignored when `url` is set. */
  searchParams?: Record<string, string>;
}

const DEFAULT_URL = "http://localhost/api/cards";

export function makeApiContext(opts: ApiContextOptions = {}): APIContext {
  const {
    user = { id: "user-1" },
    body,
    jsonThrows = false,
    headers = {},
    contentLength,
    params = {},
    url,
    searchParams,
  } = opts;

  const requestHeaders = new Headers(headers);
  if (contentLength !== undefined) {
    requestHeaders.set("content-length", String(contentLength));
  }

  const request = {
    headers: requestHeaders,
    json: (): Promise<unknown> =>
      jsonThrows ? Promise.reject(new SyntaxError("Unexpected token in JSON")) : Promise.resolve(body),
  };

  const cookies = {
    get: () => undefined,
    getAll: () => [],
    set: () => undefined,
    delete: () => undefined,
    has: () => false,
    merge: () => undefined,
    headers: () => new Headers(),
  };

  const resolvedUrl = new URL(url ?? DEFAULT_URL);
  if (!url && searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      resolvedUrl.searchParams.set(key, value);
    }
  }

  return {
    locals: { user },
    request,
    cookies,
    params,
    url: resolvedUrl,
  } as unknown as APIContext;
}
