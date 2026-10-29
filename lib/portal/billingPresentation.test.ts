import test from "node:test";
import assert from "node:assert/strict";
import { configuredMachinePlans, machinePlanRenewal } from "./billingPresentation";
import { paidDaysRemaining } from "../admin/subscriptions";
import type { BillingSubscription } from "../../types/billing";
const machine = (data: Partial<BillingSubscription> = {}) => ({ machine_id: 125, subscription_id: 2, billing_provider: "stripe", stripe_status: "active", payment_status: "unpaid", ...data } as BillingSubscription);

test("Bob's two configured machine plans exclude the third unstarted machine", () => {
  const plans = configuredMachinePlans([machine({machine_id: 118, plan_configured: true}), machine({plan_configured: true}), machine({machine_id: 159, subscription_id: null, plan_configured: false})]);
  assert.deepEqual(plans.map(plan => plan.machine_id), [118, 125]);
  assert.equal(configuredMachinePlans([machine({subscription_id: null, access_source: "admin"})]).length, 1);
});

test("canceled renewal never appears as active, regardless of whether its invoice is paid", () => {
  for (const payment_status of ["paid", "unpaid"]) {
    const renewal = machinePlanRenewal(machine({stripe_cancel_at_period_end: true, payment_status}));
    assert.equal(renewal.label, "Renewal canceled");
    assert.match(renewal.description, /remain payable/);
  }
  assert.equal(machinePlanRenewal(machine()).label, "Renewal on");
});

test("scheduled starts and renewals retain their scheduling status", () => {
  assert.equal(machinePlanRenewal(machine({stripe_status: "scheduled"})).label, "Scheduled");
  assert.equal(machinePlanRenewal(machine({stripe_cancel_at_period_end: true, stripe_resume_at: "2026-11-01T00:00:00Z"})).label, "Renewal scheduled");
  assert.equal(machinePlanRenewal(machine({stripe_status: "canceled"})).label, "Plan ended");
});

test("client day counts use the admin's complete-day calculation and color thresholds", () => {
  const now = Date.parse("2026-10-29T18:00:00Z");
  const remaining = paidDaysRemaining(new Date(now + 23.5 * 86400000).toISOString(), now);
  assert.equal(remaining?.label, "23 days left");
  assert.equal(remaining?.color, "green");
});
