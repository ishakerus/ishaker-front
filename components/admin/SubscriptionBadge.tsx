import { Badge, Tooltip, type BadgeProps } from "@chakra-ui/react";
import { paidDaysRemaining, type AdminSubscriptionMachine } from "../../lib/admin/subscriptions";

export function SubscriptionBadge({ description, children, ...props }: BadgeProps & { description: string }) {
  return <Tooltip label={description} hasArrow placement="top" openDelay={150}>
    <Badge {...props} tabIndex={0} cursor="help">{children}</Badge>
  </Tooltip>;
}

export function subscriptionStatusDescription(status: string | null | undefined) {
  const descriptions: Record<string, string> = {
    active: "The subscription is running. Paid access is shown separately by its paid-through date.",
    scheduled: "The subscription will start automatically at the scheduled date and time.",
    canceled: "The Stripe subscription has ended and will not renew automatically.",
    incomplete: "The subscription is waiting for its initial payment to be completed.",
    incomplete_expired: "The initial payment was not completed in time. A new plan is needed to restart billing.",
    trialing: "The subscription is in a trial period. A trial does not mark an invoice as paid.",
    past_due: "A subscription payment is overdue. Existing paid access keeps its recorded end date.",
    unpaid: "The subscription has an unpaid invoice. Existing paid access keeps its recorded end date.",
    paused: "Stripe has paused this subscription.",
  };
  return status ? descriptions[status] || `Current Stripe subscription status: ${status}.` : "No subscription plan has been started for this machine.";
}

export function SubscriptionPaymentBadge({ subscription, until = subscription?.ends_at, accessOverride = false, now = Date.now(), ...props }: {
  subscription?: AdminSubscriptionMachine["subscription"];
  until?: string | null;
  accessOverride?: boolean;
  now?: number;
} & Omit<BadgeProps, "children">) {
  const remaining = paidDaysRemaining(until, now);
  const payment = subscription?.stripe_payment_status;
  if (remaining && until) {
    const current = Date.parse(until) > now;
    const label = current ? `${accessOverride ? "Access" : "Paid"}, ${remaining.label.charAt(0).toLowerCase()}${remaining.label.slice(1)}`
      : remaining.label === "Expired today" ? "Expired today" : `Expired, ${remaining.label.toLowerCase()}`;
    const description = `${accessOverride ? "Administrator-granted access" : "Paid access"} ${current ? "ends" : "ended"} ${new Date(until).toLocaleString()}.${payment ? ` Latest invoice payment status: ${payment}.` : ""} Colors: green at 5+ days, yellow at 2–5 days, orange below 2 days through 2 days overdue, red after 2 days overdue.`;
    return <SubscriptionBadge {...props} colorScheme={remaining.color} textTransform="none" description={description}>{label}</SubscriptionBadge>;
  }
  const states: Record<string, { label: string; color: string; description: string }> = {
    paid: { label: "Paid", color: "green", description: "Payment is marked paid, but no paid-through date is recorded yet." },
    unpaid: { label: "Unpaid", color: "orange", description: "An invoice is unpaid. No paid-through date is recorded for this machine." },
    past_due: { label: "Payment overdue", color: "red", description: "Payment is overdue. No paid-through date is recorded for this machine." },
    pending: { label: "Payment pending", color: "gray", description: "Payment has not been confirmed. No paid-through date is recorded yet." },
    canceled: { label: "Canceled", color: "gray", description: "Billing is canceled and no paid-through date is recorded." },
  };
  const state = states[payment || ""] || { label: "No invoice", color: "gray", description: "No invoice payment status or paid-through date is recorded for this machine." };
  return <SubscriptionBadge {...props} colorScheme={state.color} textTransform="none" description={state.description}>{state.label}</SubscriptionBadge>;
}
