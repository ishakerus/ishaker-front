import { withSupportPortalApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type { PromoCode } from "../../../../types/portal";

const promoIdFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (session.access !== "client") {
    return res.status(403).json({ error: "client_access_required" });
  }

  const promoId = promoIdFrom(req.query.id);
  if (!promoId) return res.status(400).json({ error: "invalid_promo_code" });

  const params = new URLSearchParams();
  params.set("filters[id][$eq]", promoId);
  params.set("filters[client][id][$eq]", String(session.client.id));
  params.set("fields[0]", "id");
  params.set("fields[1]", "status");
  params.set("pagination[pageSize]", "1");

  try {
    const promos = await requestStrapiRestAsService<PromoCode[]>(
      `/api/promo-codes?${params.toString()}`,
    );
    const promo = promos[0];
    if (!promo) {
      return res.status(404).json({
        error: "promo_code_not_found",
        message: "Promo code was not found or does not belong to you.",
      });
    }

    if (promo.status !== "cancelled") {
      await requestStrapiRestAsService(`/api/promo-codes/${promo.id}`, {
        method: "PUT",
        body: JSON.stringify({ data: { status: "cancelled" } }),
      });
    }

    return res.status(200).json({ revoked: true });
  } catch (error) {
    console.error("[portal/promos/:id] revoke failed:", error);
    return res.status(500).json({
      error: "promo_revoke_failed",
      message: "Promo code could not be revoked.",
    });
  }
}

export default withSupportPortalApi(handler);
