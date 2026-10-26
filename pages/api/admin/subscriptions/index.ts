import type { NextApiRequest, NextApiResponse } from "next";
import { withAdminApi } from "../../../../lib/admin/access";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestWithJwt } from "../../../../services/server/strapiClient";
import { supportContext } from "../../../../lib/admin/context";
import type { AdminSubscriptionClient } from "../../../../lib/admin/subscriptions";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const params = new URLSearchParams({
    "fields[0]": "company", "fields[1]": "portal_email", "fields[2]": "subscription_billing_enabled", "fields[3]": "subscription_access_until",
    "fields[4]": "subscription_restrictions_enabled",
    "populate[users_permissions_users][fields][0]": "username", "populate[users_permissions_users][fields][1]": "email",
    "populate[machines][fields][0]": "title", "populate[machines][fields][1]": "serial_number",
    "populate[machines][populate][machine_type][fields][0]": "name",
    "populate[machines][populate][machine_type][fields][1]": "subscription_monthly_price_cents",
    "populate[machines][populate][subscription][fields][0]": "ends_at",
    "populate[machines][populate][subscription][fields][1]": "billing_provider",
    "populate[machines][populate][subscription][fields][2]": "stripe_payment_status",
    "populate[machines][populate][subscription][fields][3]": "monthly_price_cents",
    "populate[machines][populate][subscription][fields][4]": "stripe_status",
    "populate[machines][populate][subscription][fields][5]": "stripe_cancel_at_period_end",
    "populate[machines][populate][subscription][fields][6]": "stripe_current_period_end",
    "sort[0]": "company:asc", "pagination[pageSize]": "2000",
  });
  try {
    const jwt = supportContext.getStore()!.jwt;
    const [clients, stripeConfig] = await Promise.all([
      requestStrapiRestWithJwt<AdminSubscriptionClient[]>(`/api/clients?${params}`, jwt),
      requestStrapiRestWithJwt<{ managed_client_id: string | null; mode: string; test_client_name: string }>("/api/subscription-admin/config", jwt),
    ]);
    return res.status(200).json({ clients, stripeConfig });
  } catch {
    return res.status(502).json({ error: "subscription_load_failed", message: "Subscription settings could not be loaded." });
  }
}

export default withAdminApi(handler);
