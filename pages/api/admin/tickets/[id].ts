import type { NextApiRequest, NextApiResponse } from "next";
import { withAdminApi } from "../../../../lib/admin/access";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type { Ticket } from "../../../../types/strapi";

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const id = idFrom(req.query.id);
  const resolved = req.body?.resolved;
  if (!id || ![true, false, null].includes(resolved)) {
    return res.status(400).json({
      error: "invalid_ticket_resolution",
      message: "Choose resolved, not resolved, or paused.",
    });
  }

  try {
    const ticket = await requestStrapiRestAsService<Ticket>(
      `/api/tickets/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({ data: { resolved } }),
      },
    );
    return res.status(200).json({ ticket });
  } catch (error) {
    console.error("[admin/tickets/:id] update failed:", error);
    return res.status(500).json({
      error: "ticket_update_failed",
      message: "Ticket status could not be updated.",
    });
  }
}

export default withAdminApi(handler);
