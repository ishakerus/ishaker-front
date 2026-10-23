import assert from "node:assert/strict";
import test from "node:test";
import { fetchJsonWithTimeout } from "./fetchJsonWithTimeout";

const waitForAbort = (signal: AbortSignal) => new Promise<never>((_, reject) => {
  if (signal.aborted) reject(signal.reason);
  else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
});

test("returns completed responses and their JSON", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ ok: true })));
  const { response, payload } = await fetchJsonWithTimeout("https://example.test");
  assert.equal(response.status, 200);
  assert.deepEqual(payload, { ok: true });
});
test("aborts a connection that never responds", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => waitForAbort(init.signal!));
  await assert.rejects(fetchJsonWithTimeout("https://example.test", {}, 10), (error: any) => error.status === 504 && error.code === "request_timeout");
});
test("deadline also covers reading the response body", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => ({ json: () => waitForAbort(init.signal!) }));
  await assert.rejects(fetchJsonWithTimeout("https://example.test", {}, 10), (error: any) => error.status === 504);
});
test("preserves caller cancellation", async (t) => {
  const controller = new AbortController();
  const reason = new Error("Cancelled by caller");
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => waitForAbort(init.signal!));
  const result = fetchJsonWithTimeout("https://example.test", { signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(result, (error) => error === reason);
});
