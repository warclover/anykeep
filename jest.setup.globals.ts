/**
 * Jest Global Setup - Fetch API Polyfill
 *
 * This file runs BEFORE module loading (via setupFiles),
 * ensuring Fetch API globals are available when next/server is imported.
 *
 * @module jest.setup.globals
 * @since 2026-01-28
 */

// Polyfill Fetch API for Jest environment (required by next/server)
// We use node-fetch which is available in the project

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFetch = require("node-fetch");

// Polyfill static Response.json for node-fetch v2 (required by NextResponse.json)
if (!nodeFetch.Response.json) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (nodeFetch.Response as any).json = (data: any, init: any = {}) => {
    const headers = new nodeFetch.Headers(init.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return new nodeFetch.Response(JSON.stringify(data), {
      ...init,
      headers,
    });
  };
}

if (typeof globalThis.fetch === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = nodeFetch;
}

if (typeof globalThis.Request === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Request = nodeFetch.Request;
}

if (typeof globalThis.Response === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Response = nodeFetch.Response;
}

if (typeof globalThis.Headers === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Headers = nodeFetch.Headers;
}
