export type AdminSubscriptionClient = {
  id: string | number;
  company: string;
  portal_email?: string | null;
  subscription_billing_enabled?: boolean;
  subscription_restrictions_enabled?: boolean;
  subscription_access_until?: string | null;
  users_permissions_users?: Array<{ id: string | number; username?: string; email?: string }>;
  machines?: Array<{
    id: string | number;
    title?: string | null;
    serial_number?: string | null;
    machine_type?: { name?: string; subscription_monthly_price_cents?: number | null } | null;
    subscription?: {
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
