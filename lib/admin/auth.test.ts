import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createAdminSessionCookie, resolveAdminSession, type SupportUser } from "./auth";
import { createSupportCabinetCookie, readSupportCabinet, cabinetMatchesAdmin } from "./impersonation";
import { isSameOriginRequest } from "./http";
import { canSupportUseRoute, canSupportWriteStrapi } from "./permissions";
import { supportContext } from "./context";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import { withAdminApi, withSupportPortalApi } from "./access";
import fs from "node:fs/promises";
import path from "node:path";

process.env.ADMIN_SESSION_SECRET = "test-only-session-key-with-more-than-32-characters";
const user: SupportUser = { id: 7, username: "Artur", updatedAt: "2026-09-07T12:00:00.000Z", blocked: false, confirmed: true, role: { type: "support" } };
const session = () => createAdminSession(user, "support-jwt");
const cookie = () => createAdminSessionCookie(session()).split(";")[0];
const response = () => ({ statusCode: 200, headers: {} as Record<string, any>, body: undefined as any,
  setHeader(name: string, value: any) { this.headers[name] = value; },
  status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; },
});

test('legacy ADMIN_PASSWORD is only usable as a session-encryption migration fallback', async () => {
  const configuredSecret = process.env.ADMIN_SESSION_SECRET;
  const legacySecret = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = "existing-deployment-secret";
  try {
    const admin = session();
    const header = createAdminSessionCookie(admin);
    const cabinet = readSupportCabinet(
      createSupportCabinetCookie(admin, { targetUserId: 15, clientId: 23, machineId: 9 }),
    );
    assert.match(header, /^ishaker_admin_session=/);
    assert.equal(cabinetMatchesAdmin(cabinet, admin), true);
  } finally {
    if (configuredSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = configuredSecret;
    if (legacySecret === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = legacySecret;
  }
});

test('admin cookie encrypts the JWT and revalidates identity, role, block and account changes', async (t) => {
  let current: any = { ...user };
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(current)));
  const header = cookie();
  assert.ok(!decodeURIComponent(header).includes("support-jwt"));
  assert.equal((await resolveAdminSession(header))?.id, 7);
  current = { ...user, blocked: true };
  assert.equal(await resolveAdminSession(header), null);
  current = { ...user, role: { type: "portal_client" } };
  assert.equal(await resolveAdminSession(header), null);
  current = { ...user, updatedAt: "2026-09-08T00:00:00.000Z" };
  assert.equal(await resolveAdminSession(header), null);
  current = { ...user, id: 8 };
  assert.equal(await resolveAdminSession(header), null);
  assert.equal(await resolveAdminSession("ishaker_admin_session=%ZZ"), null);
  assert.equal(await resolveAdminSession("ishaker_admin_session=admin.9999999999.old-signature"), null);
  const expired = createAdminSessionCookie({ ...session(), expiresAt: Date.now() - 1 });
  assert.equal(await resolveAdminSession(expired), null);
  const altered = header.slice(0, -8) + "tampered";
  assert.equal(await resolveAdminSession(altered), null);
});

test('cabinet grants expire after 30 minutes and are bound to the exact support login', () => {
  const admin = session();
  const cabinet = readSupportCabinet(createSupportCabinetCookie(admin, { targetUserId: 15, clientId: 23, machineId: 9 }));
  assert.equal(cabinet?.targetUserId, 15);
  assert.ok(cabinet!.expiresAt <= Date.now() + 30 * 60_000);
  assert.equal(cabinetMatchesAdmin(cabinet, admin), true);
  assert.equal(cabinetMatchesAdmin(cabinet, null), false);
  assert.equal(cabinetMatchesAdmin(cabinet, { ...admin, sid: "another-login" }), false);
  assert.equal(cabinetMatchesAdmin(cabinet, { ...admin, id: 99 }), false);
  assert.equal(readSupportCabinet(createSupportCabinetCookie({ ...admin, expiresAt: Date.now() - 1 }, { targetUserId: 15, clientId: 23, machineId: 9 })), null);
});

test('support allows content edits while denying deletion, account changes, physical access and device credentials', () => {
  for (const collection of ['machines','currencies','presets','languages','translations','translation-entries','translation-sets','voice-clips','products','product-lines','tutorials']) {
    assert.ok(canSupportWriteStrapi(`/api/${collection}`, "POST"));
    assert.ok(canSupportWriteStrapi(`/api/${collection}/1`, "PUT"));
    assert.equal(canSupportWriteStrapi(`/api/${collection}/1`, "DELETE"), false);
  }
  for (const path of ["/api/users/1", "/api/clients/1", "/api/promo-codes/1", "/api/components/1", "/api/roles/1"]) assert.equal(canSupportWriteStrapi(path, "PUT"), false);
  assert.equal(canSupportUseRoute("/api/portal/nayax-settings", "PUT", "portal"), false);
  assert.equal(canSupportUseRoute("/api/portal/register-machine", "POST", "portal"), false);
  assert.equal(canSupportUseRoute("/api/portal/promos/1", "PUT", "portal"), false);
  assert.equal(canSupportUseRoute("/api/portal/machines/1/door-key", "POST", "portal"), false);
  assert.equal(canSupportUseRoute("/api/admin/machines/1/door-key", "POST", "admin"), false);
  assert.equal(canSupportUseRoute("/api/portal/product-lines/1/products/2", "PATCH", "portal"), true);
});

test('mutations require a matching origin', () => {
  const req = { method: "POST", headers: { host: "example.com", origin: "https://example.com" } };
  assert.equal(isSameOriginRequest(req as any), true);
  assert.equal(isSameOriginRequest({ ...req, headers: { ...req.headers, origin: "https://attacker.example" } } as any), false);
  assert.equal(isSameOriginRequest({ ...req, headers: { host: "example.com" } } as any), false);
});

test('writes use the support JWT and never fall back to the service account', async (t) => {
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, init: RequestInit) => {
    calls.push(init);
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  });
  await supportContext.run(session(), async () => {
    await assert.rejects(requestStrapiRestAsService("/api/products/1", { method: "PUT", body: "{}" }), { status: 403 });
    await assert.rejects(requestStrapiRestAsService("/api/users/1", { method: "PUT", body: "{}" }), { status: 403 });
  });
  assert.equal(calls.length, 1);
  assert.equal((calls[0].headers as any).Authorization, "Bearer support-jwt");
});

test('concurrent requests keep their own support credentials', async (t) => {
  const tokens: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, init: RequestInit) => {
    tokens.push((init.headers as any).Authorization);
    return new Response(JSON.stringify({ data: { id: 1, attributes: {} } }));
  });
  await Promise.all(["first", "second"].map((jwt) => supportContext.run({ ...session(), jwt }, async () => {
    await new Promise((resolve) => setTimeout(resolve, jwt === "first" ? 10 : 1));
    await requestStrapiRestAsService("/api/products/1", { method: "PUT" });
  })));
  assert.deepEqual(tokens.sort(), ["Bearer first", "Bearer second"]);
  assert.equal(supportContext.getStore(), undefined);
});

test('API boundaries deny unauthorized, cross-origin and delete requests before handlers run', async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(user)));
  let calls = 0;
  const handler = withAdminApi(async () => { calls++; });
  for (const req of [
    { method: "PUT", url: "/api/admin/currencies/1", headers: {} },
    { method: "DELETE", url: "/api/admin/currencies/1", headers: { cookie: cookie(), host: "localhost", origin: "http://localhost" } },
    { method: "PUT", url: "/api/admin/currencies/1", headers: { cookie: cookie(), host: "localhost", origin: "https://attacker.example" } },
  ]) {
    const res = response();
    await handler(req as any, res as any);
    assert.ok([401,403].includes(res.statusCode));
  }
  assert.equal(calls, 0);
  const portal = withSupportPortalApi(async () => { calls++; });
  const res = response();
  await portal({ method: "PUT", headers: { cookie: "ishaker_support_cabinet=forged" } } as any, res as any);
  assert.equal(res.statusCode, 401);
  assert.equal(calls, 0);
});

test('every admin and portal API keeps its support authorization wrapper', async () => {
  const walk = async (dir: string): Promise<string[]> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat();
  };
  for (const scope of ['admin', 'portal']) {
    const base = path.resolve('pages/api', scope);
    for (const file of (await walk(base)).filter((file) => file.endsWith('.ts'))) {
      const relative = path.relative(base, file);
      const exceptions = scope === 'admin' ? ['login.ts', 'logout.ts', 'cabinet/exit.ts'] : ['logout.ts'];
      if (exceptions.includes(relative)) continue;
      const contents = await fs.readFile(file, 'utf8');
      const wrapper = scope === 'admin' ? 'withAdminApi' : 'withSupportPortalApi';
      assert.match(contents, new RegExp(`export default ${wrapper}\\(handler\\)`), file);
    }
  }
});
