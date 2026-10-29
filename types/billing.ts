export type BillingInvoice = {
  id: string;
  number: string | null;
  subscription_id: string | null;
  status: string;
  payment_status: string;
  currency: string;
  total_cents: number;
  paid_cents: number;
  remaining_cents: number;
  created_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  payment_url: string | null;
};

export type BillingSubscription = {
  machine_id: number;
  machine_title: string | null;
  machine_type: string | null;
  subscription_id: number | null;
  starts_at: string | null;
  ends_at: string | null;
  paid_until?: string | null;
  access_source?: "admin" | "manual" | "stripe" | null;
  remaining_days: number | null;
  payment_url: string | null;
  monthly_price_cents: number | null;
  billing_provider: "manual" | "stripe";
  stripe_status: string | null;
  payment_status: string | null;
  status: string;
  notification_color: "orange" | "red" | null;
};

export type ClientBilling = {
  account_charges?: AccountCharge[];
  restrictions_enabled?: boolean;
  client_id: number;
  currency: string;
  as_of: string;
  balance_cents: number;
  credit_cents: number;
  debt_cents: number;
  subscriptions: BillingSubscription[];
  stripe: {
    test_mode: boolean;
    enabled: boolean;
    linked: boolean;
    payment_status: string;
    open_balance_cents: number;
    last_synced_at: string | null;
    invoices: BillingInvoice[];
  };
};

export type AccountCharge = {
  id: number;
  description: string;
  amount_cents: number;
  currency: string;
  frequency: "once" | "monthly" | "yearly";
  due_days: number;
  status: string;
  payment_status: string;
  outstanding_cents: number;
  renewal_canceled: boolean;
  next_invoice_at: string | null;
  created_at: string | null;
  last_synced_at: string | null;
  invoices: BillingInvoice[];
};
