import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createAdminSessionCookie, requireAdminSession, resolveAdminSession, type SupportUser } from "./auth";
import { createSupportCabinetCookie, readSupportCabinet, cabinetMatchesAdmin } from "./impersonation";
import {
  createSharedAdminPortalToken,
  readSharedAdminPortalUserId,
  verifySharedAdminPassword,
} from "../portal/adminAccess";
import {
  clearLoginFailures,
  isLoginRateLimited,
  isSameOriginRequest,
  loginAttemptKey,
  recordLoginFailure,
} from "./http";
import { canSupportUseRoute, canSupportWriteStrapi } from "./permissions";
import { supportContext } from "./context";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import { withAdminApi, withSupportPortalApi } from "./access";
import fs from "node:fs/promises";
import path from "node:path";
import portalLoginHandler from "../../pages/api/portal/login";

process.env.ADMIN_SESSION_SECRET = "test-only-session-key-with-more-than-32-characters";
const user: SupportUser = { id: 7, username: "Artur", updatedAt: "2026-09-07T12:00:00.000Z", blocked: false, confirmed: true, role: { type: "support" } };
const session = () => createAdminSession(user, "support-jwt");
const cookie = () => createAdminSessionCookie(session()).split(";")[0];
const response = () => ({ statusCode: 200, headers: {} as Record<string, any>, body: undefined as any,
  setHeader(name: string, value: any) { this.headers[name] = value; },
  status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; },
});

test('ADMIN_PASSWORD supports client-portal override but not dashboard authentication', async () => {
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
    const portalToken = createSharedAdminPortalToken(15);
    assert.match(header, /^ishaker_admin_session=/);
    assert.equal(cabinetMatchesAdmin(cabinet, admin), true);
    assert.equal(verifySharedAdminPassword("existing-deployment-secret"), true);
    assert.equal(verifySharedAdminPassword("wrong"), false);
    assert.equal(readSharedAdminPortalUserId(portalToken), 15);
    process.env.ADMIN_PASSWORD = "rotated-deployment-secret";
    assert.equal(readSharedAdminPortalUserId(portalToken), null);
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

test('cabinet grants last up to two hours and are bound to the exact support login', () => {
  const admin = session();
  const createdAt = Date.now();
  const cabinet = readSupportCabinet(createSupportCabinetCookie(admin, { targetUserId: 15, clientId: 23, machineId: 9 }));
  assert.equal(cabinet?.targetUserId, 15);
  assert.ok(cabinet!.expiresAt > createdAt + 119 * 60_000);
  assert.ok(cabinet!.expiresAt <= Date.now() + 2 * 60 * 60_000);
  assert.equal(cabinetMatchesAdmin(cabinet, admin), true);
  assert.equal(cabinetMatchesAdmin(cabinet, null), false);
  assert.equal(cabinetMatchesAdmin(cabinet, { ...admin, sid: "another-login" }), false);
  assert.equal(cabinetMatchesAdmin(cabinet, { ...admin, id: 99 }), false);
  assert.equal(readSupportCabinet(createSupportCabinetCookie({ ...admin, expiresAt: Date.now() - 1 }, { targetUserId: 15, clientId: 23, machineId: 9 })), null);
});

test('support matches client portal mutations while retaining admin-only boundaries', () => {
  for (const collection of ['machines','currencies','presets','languages','translations','translation-entries','translation-sets','voice-clips','products','product-lines','tutorials']) {
    assert.ok(canSupportWriteStrapi(`/api/${collection}`, "POST"));
    assert.ok(canSupportWriteStrapi(`/api/${collection}/1`, "PUT"));
  }
  for (const collection of ['machine-cells','preset-cells','products','product-lines','translation-entries']) {
    assert.equal(canSupportWriteStrapi(`/api/${collection}/1`, "DELETE"), true);
  }
  for (const collection of ['clients','promo-codes','components','tastes','splashes','circles','portal-registration-requests','door-accesses']) {
    assert.equal(canSupportWriteStrapi(`/api/${collection}`, "POST"), true);
  }
  for (const path of ["/api/users/1", "/api/roles/1", "/api/creds/1"]) {
    assert.equal(canSupportWriteStrapi(path, "PUT"), false);
  }
  assert.equal(canSupportWriteStrapi("/api/clients/1", "DELETE"), false);
  assert.equal(canSupportUseRoute("/api/portal/nayax-settings", "PUT", "portal"), true);
  assert.equal(canSupportUseRoute("/api/portal/register-machine", "POST", "portal"), true);
  assert.equal(canSupportUseRoute("/api/portal/promos/1", "PATCH", "portal"), true);
  assert.equal(canSupportUseRoute("/api/portal/machines/1/door-key", "POST", "portal"), true);
  assert.equal(canSupportUseRoute("/api/portal/product-lines/1", "DELETE", "portal"), true);
  assert.equal(canSupportUseRoute("/api/admin/machines/1/door-key", "POST", "admin"), false);
  assert.equal(canSupportUseRoute("/api/admin/product-lines/1", "DELETE", "admin"), false);
  assert.equal(canSupportUseRoute("/api/portal/product-lines/1/products/2", "PATCH", "portal"), true);
  assert.equal(canSupportUseRoute("/api/not-portal/products/1", "DELETE", "portal"), false);
});

test('mutations require a matching origin', () => {
  const req = { method: "POST", headers: { host: "example.com", origin: "https://example.com" } };
  assert.equal(isSameOriginRequest(req as any), true);
  assert.equal(isSameOriginRequest({ ...req, headers: { ...req.headers, origin: "https://attacker.example" } } as any), false);
  assert.equal(isSameOriginRequest({ ...req, headers: { host: "example.com" } } as any), false);
});

test('login throttling isolates source addresses and clears after success', () => {
  const first = loginAttemptKey(
    { headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.1" }, socket: {} } as any,
    "Artur.Support",
  );
  const second = loginAttemptKey(
    { headers: { "x-forwarded-for": "198.51.100.11" }, socket: {} } as any,
    "artur.support",
  );
  for (let index = 0; index < 10; index += 1) recordLoginFailure(first);
  assert.equal(isLoginRateLimited(first), true);
  assert.equal(isLoginRateLimited(second), false);
  clearLoginFailures(first);
  assert.equal(isLoginRateLimited(first), false);
});

test('the shared login routes support to admin and clients to their portal', async (t) => {
  let authenticatedUser: any = user;
  t.mock.method(globalThis, "fetch", async (url: any) => {
    const target = String(url);
    if (target.endsWith("/api/auth/local")) {
      return new Response(JSON.stringify({ jwt: "role-jwt" }));
    }
    if (target.includes("/api/users/me")) {
      return new Response(JSON.stringify(authenticatedUser));
    }
    if (target.includes("/api/support-audits/record")) {
      return new Response(JSON.stringify({ data: { id: 1, attributes: {} } }));
    }
    return new Response(JSON.stringify({ error: "unexpected_request" }), { status: 500 });
  });

  const request = {
    method: "POST",
    url: "/api/portal/login",
    headers: { host: "localhost", origin: "http://localhost" },
    socket: {},
    body: { identifier: "support@example.com", password: "password" },
  };
  const supportResponse = response();
  await portalLoginHandler(request as any, supportResponse as any);
  assert.equal(supportResponse.statusCode, 200);
  assert.equal(supportResponse.body.role, "support");
  assert.equal(supportResponse.body.redirectTo, "/admin");
  assert.ok((supportResponse.headers["Set-Cookie"] as string[]).some((value) => value.startsWith("ishaker_admin_session=")));

  authenticatedUser = {
    id: 18,
    username: "client",
    email: "client@example.com",
    updatedAt: "2026-09-09T12:00:00.000Z",
    blocked: false,
    confirmed: true,
    role: { type: "portal_client" },
    client: { id: 23, portal_access_enabled: true },
  };
  request.body.identifier = "client@example.com";
  const clientResponse = response();
  await portalLoginHandler(request as any, clientResponse as any);
  assert.equal(clientResponse.statusCode, 200);
  assert.equal(clientResponse.body.role, "client");
  assert.equal(clientResponse.body.redirectTo, "/machines");
  assert.ok((clientResponse.headers["Set-Cookie"] as string[]).some((value) => value.startsWith("ishaker_portal_session=")));
});

test('protected admin pages send signed-out users to the shared login', async () => {
  const result = await requireAdminSession({
    req: { headers: {} },
    res: { setHeader() {} },
  } as any);
  assert.equal(result?.redirect.destination, "/login");
});

test('writes use the support JWT and never fall back to the service account', async (t) => {
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, init: RequestInit) => {
    calls.push(init);
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  });
  await supportContext.run(session(), async () => {
    await assert.rejects(requestStrapiRestAsService("/api/products/1", { method: "PUT", body: "{}" }), { status: 403 });
    await assert.rejects(requestStrapiRestAsService("/api/products/1", { method: "DELETE" }), { status: 403 });
    await assert.rejects(requestStrapiRestAsService("/api/users/1", { method: "PUT", body: "{}" }), { status: 403 });
  });
  assert.equal(calls.length, 2);
  assert.equal((calls[0].headers as any).Authorization, "Bearer support-jwt");
  assert.equal((calls[1].headers as any).Authorization, "Bearer support-jwt");
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
      const exceptions = scope === 'admin' ? ['login.ts', 'logout.ts', 'cabinet/exit.ts'] : ['login.ts', 'logout.ts'];
      if (exceptions.includes(relative)) continue;
      const contents = await fs.readFile(file, 'utf8');
      const wrapper = scope === 'admin' ? 'withAdminApi' : 'withSupportPortalApi';
      assert.match(contents, new RegExp(`export default ${wrapper}\\(handler\\)`), file);
    }
  }
});
