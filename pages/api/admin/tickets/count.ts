import type { NextApiRequest, NextApiResponse } from "next";
import { withAdminApi } from "../../../../lib/admin/access";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestPayloadAsService } from "../../../../services/server/strapiClient";

type TicketCountPayload = {
  meta?: { pagination?: { total?: number } };
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const params = new URLSearchParams();
    params.set("filters[$or][0][resolved][$eq]", "false");
    params.set("filters[$or][1][resolved][$null]", "true");
    params.set("pagination[page]", "1");
    params.set("pagination[pageSize]", "1");

    const payload = await requestStrapiRestPayloadAsService<TicketCountPayload>(
      `/api/tickets?${params.toString()}`,
    );
    return res.status(200).json({
      count: Number(payload?.meta?.pagination?.total || 0),
    });
  } catch (error) {
    console.error("[admin/tickets/count] load failed:", error);
    return res.status(500).json({ error: "ticket_count_failed" });
  }
}

export default withAdminApi(handler);
