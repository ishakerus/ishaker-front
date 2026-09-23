import type { NextApiRequest, NextApiResponse } from "next";
import { withAdminApi } from "../../../../lib/admin/access";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type { Ticket } from "../../../../types/strapi";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const params = new URLSearchParams();
    params.set("sort[0]", "createdAt:desc");
    params.set("pagination[pageSize]", "2000");
    params.set("populate[client][fields][0]", "company");
    params.set("fields[0]", "description");
    params.set("fields[1]", "status");
    params.set("fields[2]", "email");
    params.set("fields[3]", "resolved");
    params.set("fields[4]", "createdAt");
    params.set("fields[5]", "updatedAt");

    const tickets = await requestStrapiRestAsService<Ticket[]>(
      `/api/tickets?${params.toString()}`,
    );
    return res.status(200).json({ tickets });
  } catch (error) {
    console.error("[admin/tickets] load failed:", error);
    return res.status(500).json({
      error: "ticket_load_failed",
      message: "Tickets could not be loaded.",
    });
  }
}

export default withAdminApi(handler);
