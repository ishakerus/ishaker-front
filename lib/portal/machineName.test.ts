import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../pages/api/portal/machines/[id]";
import type { PortalSession } from "../../types/portal";
import { supportContext } from "../admin/context";
import { MACHINE_TITLE_MAX_LENGTH } from "./machineName";

const session: PortalSession = {
  access: "client",
  user: { id: 11, email: "client@example.test" },
  client: { id: 1, company: "Test client" },
  machines: [{
    id: 5,
    title: "Lobby machine",
    serial_number: "test-serial",
    country: "USA",
    state_region: "NY",
    city: "New York",
  }],
};

async function updateMachine(
  t: TestContext,
  body: Record<string, unknown>,
  currentSession: PortalSession | null = session,
) {
  const writes: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://admin.ishaker.xyz");
    assert.equal(url.pathname, "/api/machines/5");
    if (init?.method === "PUT") {
      const { data } = JSON.parse(String(init.body));
      writes.push(data);
      return Response.json({
        data: { ...session.machines[0], ...data, nickname: "private-nickname" },
      });
    }
    // Used when a caller requests a machine outside their session's fleet.
    return Response.json({
      data: { ...session.machines[0], client: { id: 2, company: "Other client" } },
    });
  });

  let statusCode = 200;
  let payload: any;
  const req = {
    method: "PUT",
    url: "/api/portal/machines/5",
    query: { id: "5" },
    headers: {},
    body,
  } as unknown as NextApiRequest;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as NextApiResponse;

  await supportContext.run({
    id: 99,
    username: "support-test",
    jwt: "test-token",
    sid: "test-session",
    expiresAt: Date.now() + 60_000,
    updatedAt: "",
    ...(currentSession ? { portalSession: currentSession } : {}),
  }, () => handler(req, res));

  return { statusCode, payload, writes };
}

test("a client can rename their machine without changing other fields", async (t) => {
  const result = await updateMachine(t, {
    title: "  Upstairs café  ",
    nickname: "must-not-change",
    client: 2,
    serial_number: "must-not-change",
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.writes, [{ title: "Upstairs café" }]);
  assert.equal(result.payload.machine.title, "Upstairs café");
  assert.equal(result.payload.machine.serial_number, "test-serial");
  assert.equal("nickname" in result.payload.machine, false);
});

test("a rename is retained when location is updated in the same request", async (t) => {
  const result = await updateMachine(t, { title: "Gym machine", city: "Boston" });
  assert.equal(result.statusCode, 200);
  assert.equal(result.writes[0].title, "Gym machine");
  assert.equal(result.writes[0].city, "Boston");
  assert.equal(result.writes[0].country, "USA");
  assert.equal(result.writes[0].client, 1);
});

test("location-only updates preserve the current machine name", async (t) => {
  const result = await updateMachine(t, { city: "Boston" });
  assert.equal(result.statusCode, 200);
  assert.equal(result.writes[0].title, "Lobby machine");
});

test("invalid machine names are rejected before any write", async (t) => {
  for (const title of ["", "   ", "a".repeat(MACHINE_TITLE_MAX_LENGTH + 1), null, 123, {}, []]) {
    await t.test(`rejects ${JSON.stringify(title)}`, async (subtest) => {
      const result = await updateMachine(subtest, { title });
      assert.equal(result.statusCode, 400);
      assert.equal(result.payload.error, "invalid_machine_title");
      assert.deepEqual(result.writes, []);
    });
  }
});

test("machine names can use the full allowed length", async (t) => {
  const title = "a".repeat(MACHINE_TITLE_MAX_LENGTH);
  const result = await updateMachine(t, { title });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.machine.title, title);
});

test("clients cannot rename a machine belonging to another client", async (t) => {
  const result = await updateMachine(t, { title: "Other machine" }, { ...session, machines: [] });
  assert.equal(result.statusCode, 403);
  assert.equal(result.payload.error, "machine_access_denied");
  assert.deepEqual(result.writes, []);
});

test("renaming requires a client session", async (t) => {
  for (const currentSession of [null, { ...session, access: "product" as const }]) {
    await t.test(currentSession ? "product access" : "signed out", async (subtest) => {
      const result = await updateMachine(subtest, { title: "Machine" }, currentSession);
      assert.equal(result.statusCode, 401);
      assert.deepEqual(result.writes, []);
    });
  }
});
