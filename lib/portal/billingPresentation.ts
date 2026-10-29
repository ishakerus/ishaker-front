import type { BillingSubscription } from "../../types/billing";

export function configuredMachinePlans(subscriptions: BillingSubscription[]) {
  return subscriptions.filter((sub) => sub.plan_configured ?? Boolean(sub.subscription_id || sub.access_source === "admin"));
}

export function machinePlanRenewal(sub: BillingSubscription) {
  if (sub.stripe_resume_at) return { label: "Renewal scheduled", color: "blue", description: `Renewal will resume ${new Date(sub.stripe_resume_at).toLocaleString()}. Existing invoices remain payable.` };
  if (sub.stripe_status === "scheduled") return { label: "Scheduled", color: "blue", description: `The plan starts ${sub.starts_at ? new Date(sub.starts_at).toLocaleString() : "on its scheduled date"}.` };
  if (sub.stripe_cancel_at_period_end) return { label: "Renewal canceled", color: "orange", description: "Future renewal is canceled. Existing paid access keeps its paid-through date, and invoices already issued remain payable." };
  if (["canceled", "incomplete_expired"].includes(sub.stripe_status || "")) return { label: "Plan ended", color: "gray", description: "This plan has ended. Existing invoices and payment history remain available." };
  if (sub.billing_provider === "manual" || sub.access_source === "admin") return { label: "Administrator-managed", color: "gray", description: "Your administrator manages this machine’s access dates." };
  if (["incomplete", "past_due", "unpaid", "paused"].includes(sub.stripe_status || "")) return { label: sub.stripe_status === "incomplete" ? "Awaiting payment" : sub.stripe_status === "paused" ? "Paused" : "Payment overdue", color: "orange", description: "Payment and paid-through dates are shown separately. A running plan does not mean the invoice is paid." };
  return { label: "Renewal on", color: "green", description: "Recurring billing is enabled. Paid access is shown separately by the paid-through date." };
}
