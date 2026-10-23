import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../pages/api/portal/product-lines/[id]";
import { supportContext } from "../admin/context";

async function updateRestrictions(
  t: TestContext,
  excludedIds: unknown,
  options: { client?: boolean; template?: boolean; missingTarget?: boolean } = {},
) {
  const writes: any[] = [];
  const savedIdentifier = process.env.STRAPI_AUTH_IDENTIFIER;
  const savedPassword = process.env.STRAPI_AUTH_PASSWORD;
  process.env.STRAPI_AUTH_IDENTIFIER = "mix-rules@example.test";
  process.env.STRAPI_AUTH_PASSWORD = "test-only";
  t.after(() => {
    if (savedIdentifier === undefined) delete process.env.STRAPI_AUTH_IDENTIFIER;
    else process.env.STRAPI_AUTH_IDENTIFIER = savedIdentifier;
    if (savedPassword === undefined) delete process.env.STRAPI_AUTH_PASSWORD;
    else process.env.STRAPI_AUTH_PASSWORD = savedPassword;
  });
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === "/api/auth/local") return Response.json({ jwt: "test-token" });
    if (init?.method === "PUT") {
      const { data } = JSON.parse(String(init.body));
      writes.push(data);
      return Response.json({ data: { id: 23, ...data } });
    }
    if (url.pathname === "/api/product-lines") {
      if (url.searchParams.has("filters[base_product_line][id][$null]")) {
        assert.equal(url.searchParams.get("filters[base_product_line][id][$null]"), "true");
        return Response.json({ data: options.missingTarget ? [] : [{ id: 23, name: "Creatine" }] });
      }
      return Response.json({ data: [{ id: 23, name: "Creatine", is_template: options.template !== false }] });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  let statusCode = 200;
  let payload: any;
  const req = {
    method: "PATCH", query: { id: "23" }, headers: {}, body: { cannotBeAddedToIds: excludedIds },
  } as unknown as NextApiRequest;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { payload = value; return this; },
  } as unknown as NextApiResponse;
  await supportContext.run({
    id: 99, username: "support-test", jwt: "test-support-token", sid: "test-session",
    expiresAt: Date.now() + 60000, updatedAt: "",
    portalSession: {
      user: { id: 11, email: "staff@example.test" },
      client: { id: options.client ? 1 : 0, company: "Test" },
      access: options.client ? "client" : "product", machines: [],
    },
  }, () => handler(req, res));
  return { statusCode, payload, writes };
}

test("staff can exclude the same product line and clear its exclusions later", async (t) => {
  for (const excludedIds of [["23"], []]) {
    await t.test(JSON.stringify(excludedIds), async (subtest) => {
      const result = await updateRestrictions(subtest, excludedIds);
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.writes, [{ cannot_be_added_to: excludedIds.map(Number) }]);
    });
  }
});

test("clients and non-template line editors cannot change template mixing rules", async (t) => {
  for (const options of [{ client: true }, { template: false }]) {
    await t.test(JSON.stringify(options), async (subtest) => {
      const result = await updateRestrictions(subtest, ["23"], options);
      assert.equal(result.statusCode, 403);
      assert.equal(result.writes.length, 0);
    });
  }
});

test("line exclusions validate IDs and reject missing or non-root destinations", async (t) => {
  for (const excludedIds of [["23", "23"], ["bad"], null]) {
    await t.test(JSON.stringify(excludedIds), async (subtest) => {
      const result = await updateRestrictions(subtest, excludedIds);
      assert.equal(result.statusCode, 400);
      assert.equal(result.writes.length, 0);
    });
  }
  await t.test("missing destination", async (subtest) => {
    const result = await updateRestrictions(subtest, ["23"], { missingTarget: true });
    assert.equal(result.statusCode, 400);
    assert.equal(result.writes.length, 0);
  });
});
