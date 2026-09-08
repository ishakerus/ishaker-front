import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import { parseCurrency } from "./index";

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (!["PUT", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const id = idFrom(req.query.id);
  if (!id) return res.status(400).json({ error: "invalid_currency" });

  try {
    if (req.method === "DELETE") {
      await requestStrapiRestAsService(`/api/currencies/${id}`, {
        method: "DELETE",
      });
      return res.status(200).json({ deleted: true });
    }
    const data = parseCurrency(req.body);
    if (!data) {
      return res.status(400).json({
        error: "invalid_currency",
        message: "Complete all currency formatting fields with valid values.",
      });
    }
    const currency = await requestStrapiRestAsService(
      `/api/currencies/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({ data }),
      },
    );
    return res.status(200).json({ currency });
  } catch (error) {
    console.error("[admin/currencies/:id] request failed:", error);
    return res.status(500).json({
      error: "currency_request_failed",
      message: "Currency could not be updated.",
    });
  }
}

export default withAdminApi(handler);
