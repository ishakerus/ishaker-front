import type { NextApiRequest, NextApiResponse } from "next";
import type { ClientBilling } from "../../types/billing";
import type { Client } from "../../types/strapi";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import { getPortalSessionFromApiRequest, readPortalJwt } from "./auth";
import { isSharedAdminPortalToken } from "./adminAccess";

type Target = { kind: "machine" | "line" | "product" | "promo"; id: string } | { kind: "fleet" };

export function subscriptionWriteTarget(method: string, path: string, body: any): Target | null {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;
  const machine = path.match(/^\/api\/portal\/machines\/(\d+)(?:\/([a-z-]+))?$/);
  if (machine) {
    if (["door-key", "inventory"].includes(machine[2])) return null;
    if (machine[2] === "free-mode" && body?.enabled === false) return null;
    return { kind: "machine", id: machine[1] };
  }
  const line = path.match(/^\/api\/portal\/product-lines\/(\d+)(?:\/|$)/);
  if (line) return { kind: "line", id: line[1] };
  const product = path.match(/^\/api\/portal\/products\/(\d+)$/);
  if (product) return { kind: "product", id: product[1] };
  const promo = path.match(/^\/api\/portal\/promos\/(\d+)$/);
  if (promo && method !== "DELETE" && body?.isActive !== false) return { kind: "promo", id: promo[1] };
  if (path === "/api/portal/promos" && method === "POST") {
    const machineId = typeof body?.machineId === "string" || typeof body?.machineId === "number" ? String(body.machineId) : "";
    return /^\d+$/.test(machineId) ? { kind: "machine", id: machineId } : { kind: "fleet" };
  }
  if (["/api/portal/product-lines", "/api/portal/product-lines/editor", "/api/portal/nayax-settings"].includes(path)) return { kind: "fleet" };
  return null;
}

export function blockedSubscriptionMachines(billing: ClientBilling) {
  return billing.subscriptions.filter((sub) => !["active", "orange", "red"].includes(sub.status)).map((sub) => String(sub.machine_id));
}

export function shouldEnforceSubscriptionRestrictions(client: Pick<Client, "subscription_billing_enabled" | "subscription_restrictions_enabled">) {
  return client.subscription_billing_enabled === true && client.subscription_restrictions_enabled !== false;
}

export async function guardSubscriptionWrite(req: NextApiRequest, res: NextApiResponse) {
  const target = subscriptionWriteTarget(req.method || "", (req.url || "").split("?")[0], req.body);
  if (!target) return false;
  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client" || !shouldEnforceSubscriptionRestrictions(session.client) ||
      session.support || isSharedAdminPortalToken(readPortalJwt(req.headers.cookie))) return false;
  try {
    const billing = await requestStrapiRestAsService<ClientBilling>(`/api/client-billing/${session.client.id}`);
    const blocked = new Set(blockedSubscriptionMachines(billing));
    if (!blocked.size) return false;
    let affected = target.kind === "fleet" || (target.kind === "machine" && blocked.has(target.id));
    if (target.kind === "line" || target.kind === "product") {
      const line = target.kind === "line" ? await requestStrapiRestAsService<any>(`/api/product-lines/${target.id}?populate[0]=machines`) :
        (await requestStrapiRestAsService<any>(`/api/products/${target.id}?populate[product_line][populate][0]=machines`)).product_line;
      affected = (line?.machines || []).some((machine: { id: string | number }) => blocked.has(String(machine.id)));
    } else if (target.kind === "promo") {
      const promo = await requestStrapiRestAsService<any>(`/api/promo-codes/${target.id}?populate[0]=machine&populate[1]=client`);
      affected = String(promo.client?.id) === String(session.client.id) && (!promo.machine || blocked.has(String(promo.machine.id)));
    }
    if (!affected) return false;
    res.status(402).json({ error: "subscription_required", message: "This machine needs a paid subscription before changing its configuration, deploying products, creating promotions, or enabling free mode.", billing_url: "/billing" });
    return true;
  } catch {
    res.status(503).json({ error: "subscription_check_unavailable", message: "Subscription status could not be checked. Please try again." });
    return true;
  }
}
