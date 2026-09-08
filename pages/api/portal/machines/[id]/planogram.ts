import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../../lib/portal/auth";
import {
  fetchStrapiCatalogEndpoint,
  hasStrapiCatalogToken,
} from "../../../../../services/server/strapiClient";

const asId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client") {
    return res.status(401).json({ error: "unauthorized" });
  }
  const machineId = asId(req.query.id);
  const machine = machineId
    ? await assertMachineBelongsToSessionClient(session, machineId)
    : null;
  if (!machine) return res.status(403).json({ error: "machine_access_denied" });
  if (!machine.serial_number) {
    return res.status(409).json({
      error: "machine_has_no_serial",
      message: "Planogram validation requires a machine serial number.",
    });
  }
  if (!hasStrapiCatalogToken()) {
    return res.status(200).json({
      skipped: true,
      reason: "catalog_token_not_configured",
      problems: [],
      warnings: [],
    });
  }

  try {
    const upstream = await fetchStrapiCatalogEndpoint(
      `/api/machines/${encodeURIComponent(machine.serial_number)}/planogram`,
    );
    const payload = await upstream.json().catch(() => ({}));
    const source = upstream.headers.get("x-planogram-source");
    if (source) res.setHeader("X-Planogram-Source", source);
    if (!upstream.ok && upstream.status !== 422) {
      return res.status(upstream.status).json({
        error: payload?.error || "planogram_validation_failed",
        message:
          payload?.message ||
          payload?.error?.message ||
          "The planogram validator is unavailable.",
      });
    }
    return res.status(upstream.status).json(payload);
  } catch (error) {
    console.error("[portal/machines/:id/planogram] validation failed:", error);
    return res.status(502).json({
      error: "planogram_unavailable",
      message: "The saved planogram could not be validated.",
    });
  }
}

export default withSupportPortalApi(handler);
