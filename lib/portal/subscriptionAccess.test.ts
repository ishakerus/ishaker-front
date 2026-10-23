import test from "node:test";
import assert from "node:assert/strict";
import { blockedSubscriptionMachines, subscriptionWriteTarget } from "./subscriptionAccess";
import type { ClientBilling } from "../../types/billing";

test("expired-machine write targets come from the URL, independent of browser machine IDs", () => {
  assert.deepEqual(subscriptionWriteTarget("PUT", "/api/portal/machines/118/cells", { machineId: 125 }), { kind: "machine", id: "118" });
  assert.deepEqual(subscriptionWriteTarget("PUT", "/api/portal/machines/118/free-mode", { enabled: true }), { kind: "machine", id: "118" });
  assert.deepEqual(subscriptionWriteTarget("PATCH", "/api/portal/product-lines/3", {}), { kind: "line", id: "3" });
  assert.deepEqual(subscriptionWriteTarget("POST", "/api/portal/promos", { machineId: 118 }), { kind: "machine", id: "118" });
});

test("billing, support, history, door access, inventory and disabling free mode stay available", () => {
  for (const [method, path, body] of [
    ["POST", "/api/portal/billing", {}], ["GET", "/api/portal/sales", {}],
    ["POST", "/api/portal/machines/118/door-key", {}], ["PUT", "/api/portal/machines/118/inventory", {}],
    ["PUT", "/api/portal/machines/118/free-mode", { enabled: false }],
  ] as const) assert.equal(subscriptionWriteTarget(method, path, body), null);
});

test("warnings preserve access; expired, missing and unpaid subscriptions restrict writes", () => {
  const billing = { subscriptions: ["active", "orange", "red", "expired", "unpaid", "unconfigured"].map((status, index) => ({ machine_id: index + 1, status })) } as ClientBilling;
  assert.deepEqual(blockedSubscriptionMachines(billing), ["4", "5", "6"]);
});
