import test from "node:test";
import assert from "node:assert/strict";
import { endOfLocalDay, localDateValue, parseSubscriptionPlan, subscriptionPlanStatus } from "./subscriptions";
import { canSupportUseRoute } from "./permissions";

test("subscription writes accept explicit booleans and canonical dates, including past dates for expiry", () => {
  const until = "2026-10-01T23:59:59.999Z";
  assert.deepEqual(parseSubscriptionPlan({ restrictionsEnabled: true, accessUntil: until }), { subscription_restrictions_enabled: true, subscription_access_until: until, subscription_billing_enabled: true });
  assert.deepEqual(parseSubscriptionPlan({ restrictionsEnabled: false, accessUntil: null }), { subscription_restrictions_enabled: false, subscription_access_until: null });
});

test("invalid dates, ambiguous booleans and financial fields are rejected", () => {
  for (const body of [
    { restrictionsEnabled: "true", accessUntil: null }, { restrictionsEnabled: true },
    { restrictionsEnabled: true, accessUntil: "2026-02-30T00:00:00.000Z" },
    { restrictionsEnabled: true, accessUntil: "not a date" },
    { restrictionsEnabled: true, accessUntil: null, stripe_customer_id: "cus_other" },
  ]) assert.equal(parseSubscriptionPlan(body), null);
});

test("a selected date includes its full local day and invalid calendar dates are rejected", () => {
  const until = endOfLocalDay("2026-11-01")!;
  assert.equal(localDateValue(until), "2026-11-01");
  const date = new Date(until);
  assert.equal(date.getHours(), 23);
  assert.equal(date.getMinutes(), 59);
  assert.equal(date.getMilliseconds(), 999);
  assert.equal(endOfLocalDay(""), null);
  assert.throws(() => endOfLocalDay("2026-02-30"));
});

test("inactive, expired and Stripe-managed plans remain distinguishable", () => {
  const now = Date.parse("2026-10-26T00:00:00.000Z");
  assert.equal(subscriptionPlanStatus({ subscription_billing_enabled: false, subscription_access_until: "2026-12-01T00:00:00.000Z" }, now), "Restrictions off");
  assert.equal(subscriptionPlanStatus({ subscription_billing_enabled: true, subscription_access_until: "2026-10-25T00:00:00.000Z" }, now), "Expired");
  assert.equal(subscriptionPlanStatus({ subscription_billing_enabled: true, subscription_access_until: null }, now), "Using Stripe dates");
});

test("admin can update a subscription plan without permission to create or delete clients", () => {
  assert.equal(canSupportUseRoute("/api/admin/subscriptions/30", "PUT", "admin"), true);
  assert.equal(canSupportUseRoute("/api/admin/subscriptions/30", "DELETE", "admin"), false);
  assert.equal(canSupportUseRoute("/api/admin/subscriptions", "POST", "admin"), false);
  assert.equal(canSupportUseRoute("/api/admin/subscriptions/30/plan", "POST", "admin"), true);
});
