import test from "node:test";
import assert from "node:assert/strict";
import { subscriptionStartShortcut, subscriptionSearchResults, subscriptionClientHref, subscriptionMachineSummary, filterSubscriptionMachines, clientOptionLabel, matchesSubscriptionClient, paidDaysRemaining, tomorrowMidnight, endOfLocalDay, localDateValue, parseSubscriptionPlan, subscriptionPlanStatus } from "./subscriptions";
import { canSupportUseRoute } from "./permissions";

test("subscription writes accept explicit booleans and canonical dates, including past dates for expiry", () => {
  const until = "2026-10-01T23:59:59.999Z";
  assert.deepEqual(parseSubscriptionPlan({ restrictionsEnabled: true, accessUntil: until }), { subscription_restrictions_enabled: true, subscription_access_until: until, subscription_billing_enabled: true });
  assert.deepEqual(parseSubscriptionPlan({ restrictionsEnabled: false, accessUntil: null }), { subscription_billing_enabled: true, subscription_restrictions_enabled: false, subscription_access_until: null });
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


test("client options show nickname and one location and search machine ownership", () => {
  const client = { id: 30, company: "bob", state: "NY", city: "Brooklyn", country: "USA", portal_email: "private@example.com", machines: [{ id: 125, serial_number: "26010053", nickname: "Gym entrance", title: "Main lobby shaker" }] };
  assert.equal(clientOptionLabel(client), "bob — NY");
  assert.equal(clientOptionLabel({ ...client, state: "" }), "bob — Brooklyn");
  assert.equal(clientOptionLabel({ ...client, state: "", city: "" }), "bob — USA");
  for (const query of ["bob", " ny ", "BROOKLYN", "260100", "gym entrance", "main lobby"]) assert.equal(matchesSubscriptionClient(client, query), true);
  assert.equal(matchesSubscriptionClient(client, "other machine"), false);
  assert.equal(matchesSubscriptionClient(client, "private@example.com"), false);
});

test("paid-days colors include exact boundaries and overdue time", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  for (const [days, color] of [[6, "green"], [5, "green"], [4.999, "yellow"], [2, "yellow"], [1.999, "orange"], [0, "orange"], [-1, "orange"], [-2, "orange"], [-2.001, "red"]] as const) {
    assert.equal(paidDaysRemaining(new Date(now + days * 86400000).toISOString(), now)?.color, color);
  }
  assert.equal(paidDaysRemaining(new Date(now + 5 * 86400000).toISOString(), now)?.label, "5 days left");
  assert.equal(paidDaysRemaining(new Date(now - 3 * 86400000).toISOString(), now)?.label, "3 days overdue");
  assert.equal(paidDaysRemaining(new Date(now - 3 * 86400000 - 1000).toISOString(), now)?.label, "3 days overdue");
  assert.equal(paidDaysRemaining(new Date(now + 3600000).toISOString(), now)?.label, "Less than 1 day left");
  assert.equal(paidDaysRemaining(null, now), null);
});

test("tomorrow 12am uses the next local calendar day, including DST changes", () => {
  for (const value of ["2026-10-31T23:15:00", "2026-12-31T09:00:00"]) {
    const now = new Date(value);
    const tomorrow = new Date(tomorrowMidnight(now));
    assert.equal(tomorrow.getHours(), 0);
    assert.equal(tomorrow.getMinutes(), 0);
    const expected = new Date(now); expected.setDate(expected.getDate() + 1);
    assert.equal(localDateValue(tomorrow.toISOString()), localDateValue(expected.toISOString()));
  }
});


test("machine overview defaults to expired, unpaid and soon-expiring enrolled machines", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  const end = (days: number) => new Date(now + days * 86400000).toISOString();
  const clients = [{ id: 30, company: "bob", subscription_billing_enabled: true, subscription_restrictions_enabled: false, machines: [
    { id: 1, nickname: "active", subscription: { ends_at: end(20), billing_provider: "stripe", stripe_status: "active" } },
    { id: 2, nickname: "soon", subscription: { ends_at: end(5), billing_provider: "manual" } },
    { id: 3, nickname: "expired", subscription: { ends_at: end(-3), billing_provider: "stripe", stripe_status: "active" } },
    { id: 4, nickname: "new", subscription: null },
    { id: 5, nickname: "unpaid", subscription: { billing_provider: "stripe", stripe_status: "active", stripe_payment_status: "unpaid" } },
    { id: 6, nickname: "scheduled", subscription: { billing_provider: "stripe", stripe_status: "scheduled", starts_at: end(1) } },
    { id: 7, nickname: "abandoned checkout", subscription: { billing_provider: "stripe", stripe_payment_status: "pending" } },
    { id: 8, nickname: "canceled before start", subscription: { billing_provider: "stripe", stripe_status: "canceled" } },
  ] }];
  const rows = subscriptionMachineSummary(clients, now);
  assert.deepEqual(filterSubscriptionMachines(rows, "attention").map((row) => row.machine.id), [5, 3, 2]);
  assert.deepEqual(filterSubscriptionMachines(rows, "not_activated").map((row) => row.machine.id), [4, 7, 8]);
  assert.equal(filterSubscriptionMachines(rows, "connected").length, 5);
  assert.equal(filterSubscriptionMachines(rows, "all").length, 8);
  assert.equal(rows.find((row) => row.machine.id === 3)?.remaining?.color, "red");
  assert.equal(rows.find((row) => row.machine.id === 6)?.state, "scheduled");
  assert.equal(subscriptionClientHref(30), "/admin/subscriptions/30");
});

test("overview uses explicit client access overrides without changing recorded payment", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  const future = new Date(now + 20 * 86400000).toISOString();
  const past = new Date(now - 86400000).toISOString();
  const client = { id: 30, company: "bob", subscription_billing_enabled: true, subscription_access_until: future, machines: [{ id: 1, subscription: { ends_at: past, stripe_status: "active", stripe_payment_status: "paid" } }] };
  const rows = subscriptionMachineSummary([client], now);
  assert.equal(rows[0].state, "active");
  assert.equal(rows[0].until, future);
  assert.equal(rows[0].machine.subscription?.ends_at, past);
  assert.equal(filterSubscriptionMachines(rows, "attention").length, 0);
  assert.equal(subscriptionMachineSummary([{ ...client, subscription_access_until: past }], now)[0].state, "expired");
  assert.equal(subscriptionMachineSummary([{ ...client, subscription_billing_enabled: false }], now)[0].until, past);
});


test("search includes unregistered machines without inventing a client", () => {
  const clients = [{ id: 30, company: "bob", machines: [{ id: 159, nickname: "swan" }] }];
  const machines = [{ id: 162, nickname: "Unassigned Bear", serial_number: "SERIAL-162", title: "Warehouse machine" }];
  for (const query of ["BEAR", "serial-162", "warehouse"]) {
    const results = subscriptionSearchResults(clients, machines, query);
    assert.equal(results.length, 1);
    assert.equal(results[0].unregistered, true);
    assert.equal(results[0].href, "/admin/machines/162");
    assert.equal(results[0].clientId, "");
  }
  const assigned = subscriptionSearchResults(clients, machines, "swan");
  assert.equal(assigned[0].unregistered, false);
  assert.equal(assigned[0].href, "/admin/subscriptions/30");
  assert.equal(subscriptionSearchResults(clients, machines, "").length, 2);
  assert.equal(subscriptionSearchResults(clients, machines, "missing").length, 0);
});


test("start-date shortcuts use local calendar boundaries for weeks and months", () => {
  const monday = new Date("2026-10-26T15:30:00");
  assert.equal(subscriptionStartShortcut("now", monday), "");
  assert.equal(subscriptionStartShortcut("tomorrow", monday), "2026-10-27T00:00");
  assert.equal(subscriptionStartShortcut("in_three_days", monday), "2026-10-29T00:00");
  assert.equal(subscriptionStartShortcut("next_week", monday), "2026-11-02T00:00");
  assert.equal(subscriptionStartShortcut("next_week", new Date("2026-11-01T15:30:00")), "2026-11-02T00:00");
  assert.equal(subscriptionStartShortcut("next_month", new Date("2026-01-31T15:30:00")), "2026-02-01T00:00");
  assert.equal(subscriptionStartShortcut("next_month", new Date("2026-12-31T15:30:00")), "2027-01-01T00:00");
});


test("a scheduled renewal stays enrolled after its previous Stripe plan ends", () => {
  const now = Date.parse("2026-10-27T12:00:00Z");
  const clients = [{ id: 30, company: "bob", status: "client", machines: [{ id: 1, subscription: { stripe_status: "canceled", stripe_resume_at: "2026-11-01T00:00:00.000Z", stripe_resume_price_cents: 10000 } }] }];
  const rows = subscriptionMachineSummary(clients, now);
  assert.equal(rows[0].state, "scheduled");
  assert.equal(filterSubscriptionMachines(rows, "not_activated").length, 0);
  assert.equal(filterSubscriptionMachines(rows, "connected").length, 1);
});

test("support can issue and cancel account invoices through the scoped billing action", () => {
  assert.equal(canSupportUseRoute("/api/admin/subscriptions/47/invoices", "POST", "admin"), true);
  assert.equal(canSupportUseRoute("/api/admin/subscriptions/47/invoices", "DELETE", "admin"), false);
});
