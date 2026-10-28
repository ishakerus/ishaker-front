export type AdminSubscriptionClient = {
  id: string | number;
  company: string;
  status?: string | null;
  state?: string | null; city?: string | null; country?: string | null;
  portal_email?: string | null;
  subscription_billing_enabled?: boolean;
  subscription_restrictions_enabled?: boolean;
  subscription_access_until?: string | null;
  users_permissions_users?: Array<{ id: string | number; username?: string; email?: string }>;
  machines?: Array<{
    id: string | number;
    nickname?: string | null;
    title?: string | null;
    serial_number?: string | null;
    machine_type?: { name?: string; subscription_monthly_price_cents?: number | null } | null;
    subscription?: {
      stripe_resume_at?: string | null; stripe_resume_price_cents?: number | null;
      starts_at?: string | null;
      ends_at?: string | null; billing_provider?: string; stripe_payment_status?: string;
      monthly_price_cents?: number; stripe_status?: string | null;
      stripe_cancel_at_period_end?: boolean; stripe_current_period_end?: string | null;
    } | null;
  }>;
};

export function parseSubscriptionPlan(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["restrictionsEnabled", "accessUntil"].includes(key))) return null;
  if (typeof data.restrictionsEnabled !== "boolean") return null;
  if (data.accessUntil !== null && (typeof data.accessUntil !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.accessUntil) ||
      !Number.isFinite(Date.parse(data.accessUntil)) || new Date(data.accessUntil).toISOString() !== data.accessUntil)) return null;
  return { subscription_billing_enabled: true, subscription_restrictions_enabled: data.restrictionsEnabled, subscription_access_until: data.accessUntil as string | null };
}

export function subscriptionPlanStatus(client: Pick<AdminSubscriptionClient, "subscription_billing_enabled" | "subscription_restrictions_enabled" | "subscription_access_until">, now = Date.now()) {
  if (!client.subscription_billing_enabled || client.subscription_restrictions_enabled === false) return "Restrictions off";
  if (!client.subscription_access_until) return "Using Stripe dates";
  return Date.parse(client.subscription_access_until) > now ? "Active" : "Expired";
}

export function localDateValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function endOfLocalDay(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  if (!Number.isFinite(date.getTime()) || localDateValue(date.toISOString()) !== value) throw new Error("Enter a valid end date.");
  return date.toISOString();
}

export function clientOptionLabel(client: AdminSubscriptionClient) {
  const location = client.state?.trim() || client.city?.trim() || client.country?.trim();
  return `${client.company}${location ? ` — ${location}` : ""}`;
}

export function matchesSubscriptionClient(client: AdminSubscriptionClient, query: string) {
  const search = query.trim().toLowerCase();
  return [client.company, client.state, client.city, client.country,
    ...(client.machines || []).flatMap((machine) => [machine.serial_number, machine.nickname, machine.title])]
    .some((value) => value?.toLowerCase().includes(search));
}

export function localDateTimeValue(date: Date) {
  return `${localDateValue(date.toISOString())}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function tomorrowMidnight(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return localDateTimeValue(date);
}

export function paidDaysRemaining(until: string | null | undefined, now = Date.now()) {
  if (!until || !Number.isFinite(Date.parse(until))) return null;
  const days = (Date.parse(until) - now) / 86400000;
  const color = days >= 5 ? "green" : days >= 2 ? "yellow" : days >= -2 ? "orange" : "red";
  // Display complete days; color always uses the exact duration.
  const count = Math.floor(Math.abs(days));
  const label = days === 0 ? "Expired today" : count === 0 ? days > 0 ? "Less than 1 day left" : "Less than 1 day overdue"
    : `${count} ${count === 1 ? "day" : "days"} ${days > 0 ? "left" : "overdue"}`;
  return { color, label };
}


export type SubscriptionMachineFilter = "attention" | "connected" | "not_activated" | "all";
export type SubscriptionMachineState = "expired" | "unpaid" | "expiring" | "active" | "scheduled" | "not_activated";

export function subscriptionClientHref(id: string | number) {
  return `/admin/subscriptions/${encodeURIComponent(String(id))}`;
}

export function subscriptionMachineSummary(clients: AdminSubscriptionClient[], now = Date.now()) {
  return clients.flatMap((client) => (client.machines || []).map((machine) => {
    const sub = machine.subscription;
    const override = client.subscription_billing_enabled && client.subscription_access_until;
    const until = override || sub?.ends_at || null;
    const deadline = until ? Date.parse(until) : NaN;
    const hasDate = Number.isFinite(deadline);
    const scheduled = Boolean(sub?.stripe_resume_at) || sub?.stripe_status === "scheduled" || (sub?.starts_at && Date.parse(sub.starts_at) > now);
    const connected = Boolean(override || sub?.stripe_resume_at || sub?.ends_at || sub?.billing_provider === "manual" || (sub?.stripe_status && !["canceled", "incomplete_expired"].includes(sub.stripe_status)));
    const state: SubscriptionMachineState = !connected ? "not_activated"
      : hasDate ? deadline <= now ? "expired" : deadline - now <= 5 * 86400000 ? "expiring" : "active"
      : scheduled ? "scheduled" : "unpaid";
    return { client, machine, until: hasDate ? until : null, deadline: hasDate ? deadline : null, state, remaining: hasDate ? paidDaysRemaining(until, now) : null };
  })).sort((a, b) => {
    const priority: Record<SubscriptionMachineState, number> = { expired: 0, unpaid: 0, expiring: 1, active: 2, scheduled: 3, not_activated: 4 };
    return priority[a.state] - priority[b.state] || (a.deadline ?? -Infinity) - (b.deadline ?? -Infinity) || a.client.company.localeCompare(b.client.company) || String(a.machine.id).localeCompare(String(b.machine.id));
  });
}

export function filterSubscriptionMachines(rows: ReturnType<typeof subscriptionMachineSummary>, filter: SubscriptionMachineFilter) {
  return rows.filter((row) => filter === "all" || (filter === "attention" ? ["expired", "unpaid", "expiring"].includes(row.state) : filter === "not_activated" ? row.state === "not_activated" : row.state !== "not_activated"));
}


export type AdminSubscriptionMachine = NonNullable<AdminSubscriptionClient["machines"]>[number];

export function subscriptionSearchResults(clients: AdminSubscriptionClient[], unassignedMachines: AdminSubscriptionMachine[], query: string) {
  const search = query.trim().toLowerCase();
  return [
    ...clients.filter((client) => matchesSubscriptionClient(client, query)).map((client) => ({
      key: `client-${client.id}`, label: clientOptionLabel(client), href: subscriptionClientHref(client.id), clientId: String(client.id), unregistered: false,
    })),
    ...unassignedMachines.filter((machine) => [machine.nickname, machine.serial_number, machine.title].some((value) => value?.toLowerCase().includes(search))).map((machine) => ({
      key: `machine-${machine.id}`, label: machine.nickname || machine.title || machine.serial_number || `Machine #${machine.id}`,
      href: `/admin/machines/${encodeURIComponent(String(machine.id))}`, clientId: "", unregistered: true,
    })),
  ];
}


export type SubscriptionStartShortcut = "now" | "tomorrow" | "in_three_days" | "next_week" | "next_month";

export function subscriptionStartShortcut(shortcut: SubscriptionStartShortcut, now = new Date()) {
  if (shortcut === "now") return "";
  if (shortcut === "tomorrow") return tomorrowMidnight(now);
  const date = new Date(now);
  if (shortcut === "in_three_days") date.setDate(date.getDate() + 3);
  if (shortcut === "next_week") date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  if (shortcut === "next_month") { date.setDate(1); date.setMonth(date.getMonth() + 1); }
  date.setHours(0, 0, 0, 0);
  return localDateTimeValue(date);
}
