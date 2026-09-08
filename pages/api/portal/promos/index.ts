import { withSupportPortalApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../lib/portal/auth";
import { hasPromoCodeScopeConflict } from "../../../../lib/portal/promoScope";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type { PromoCode } from "../../../../types/portal";

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const getErrorPayload = (error: unknown) => {
  const apiError = error as {
    status?: number;
    response?: {
      error?: {
        message?: string;
        details?: unknown;
        name?: string;
      };
    };
    message?: string;
  };

  return {
    status: apiError.status || 500,
    message:
      apiError.response?.error?.message ||
      apiError.response?.error?.name ||
      apiError.message ||
      "Promo creation failed.",
    details: apiError.response?.error?.details || null,
  };
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getPortalSessionFromApiRequest(req);

  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (session.access !== "client") {
    return res.status(403).json({ error: "client_access_required" });
  }

  if (req.method === "POST") {
    // The kiosk uppercases whatever the customer types or scans before it checks the
    // code with the telemetry backend, and that backend matches exactly — a code stored
    // in any other case could never be redeemed.
    const code = asString(req.body?.code).toUpperCase();
    const discountType = asString(req.body?.discountType) as "PERCENT" | "FIXED";
    const amount = Number(req.body?.amount);
    const startAt = asString(req.body?.startAt);
    const endAt = asString(req.body?.endAt);
    const qtyRaw = Number(req.body?.qty);
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.trunc(qtyRaw) : null;
    const machineIdRaw = req.body?.machineId;

    if (!code || !discountType || !Number.isFinite(amount) || !startAt || !endAt) {
      return res.status(400).json({ error: "missing_required_fields" });
    }

    if (discountType === "PERCENT" && amount > 100) {
      return res.status(400).json({
        error: "invalid_discount",
        message: "Percentage discount cannot be more than 100%.",
      });
    }

    const startsAtMs = new Date(startAt).getTime();
    const endsAtMs = new Date(endAt).getTime();
    if (
      !Number.isFinite(startsAtMs) ||
      !Number.isFinite(endsAtMs) ||
      endsAtMs <= startsAtMs
    ) {
      return res.status(400).json({
        error: "invalid_promo_dates",
        message: "Ends at must be later than Starts at.",
      });
    }
    const startsAtIso = new Date(startsAtMs).toISOString();
    const endsAtIso = new Date(endsAtMs).toISOString();

    const machineId =
      typeof machineIdRaw === "string" || typeof machineIdRaw === "number"
        ? machineIdRaw
        : null;

    if (machineId) {
      const machine = await assertMachineBelongsToSessionClient(session, machineId);
      if (!machine) {
        return res.status(403).json({ error: "machine_access_denied" });
      }
    }

    try {
      const duplicateParams = new URLSearchParams();
      duplicateParams.set("filters[client][id][$eq]", String(session.client.id));
      duplicateParams.set("filters[code][$eq]", code);
      duplicateParams.set("fields[0]", "id");
      duplicateParams.set("fields[1]", "code");
      duplicateParams.set("populate[machine][fields][0]", "id");
      duplicateParams.set("pagination[pageSize]", "2000");
      const matchingPromos = await requestStrapiRestAsService<PromoCode[]>(
        `/api/promo-codes?${duplicateParams.toString()}`,
      );

      if (hasPromoCodeScopeConflict(matchingPromos, code, machineId)) {
        return res.status(409).json({
          error: "duplicate_promo_code",
          message: machineId
            ? "This promo code already exists on the selected machine."
            : "This promo code overlaps an existing promo on one or more machines.",
        });
      }

      const response = await requestStrapiRestAsService("/api/promo-codes", {
        method: "POST",
        body: JSON.stringify({
          data: {
            title: asString(req.body?.title),
            code,
            discount_type: discountType,
            amount,
            ...(qty ? { qty } : {}),
            start_at: startsAtIso,
            end_at: endsAtIso,
            notes: asString(req.body?.notes),
            status: "draft",
            client: session.client.id,
            ...(machineId ? { machine: machineId } : {}),
          },
        }),
      });

      return res.status(200).json({ ok: true, promo: response });
    } catch (error) {
      console.error("[portal/promos] create failed:", error);
      const payload = getErrorPayload(error);
      return res.status(payload.status).json({
        error: "promo_creation_failed",
        message: payload.message,
        details: payload.details,
      });
    }
  }

  res.setHeader("Allow", ["POST"]);
  return res.status(405).json({ error: "method_not_allowed" });
}

export default withSupportPortalApi(handler);
