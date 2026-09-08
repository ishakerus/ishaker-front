import { withSupportPortalApi } from "../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  isValidNickname,
  normalizeNickname,
} from "../../../lib/portal/nickname";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";
import type { Client } from "../../../types/strapi";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const nickname = normalizeNickname(
    Array.isArray(req.query.nickname)
      ? req.query.nickname[0]
      : req.query.nickname,
  );

  if (!isValidNickname(nickname)) {
    return res.status(400).json({
      error: "invalid_nickname",
      message:
        "Nickname must use 3–32 letters, numbers, hyphens, or underscores with no spaces.",
    });
  }

  try {
    const params = new URLSearchParams();
    params.set("filters[company][$eqi]", nickname);
    params.set("fields[0]", "company");
    params.set("pagination[pageSize]", "1");
    const clients = await requestStrapiRestAsService<Client[]>(
      `/api/clients?${params.toString()}`,
    );

    return res.status(200).json({
      nickname,
      available: clients.length === 0,
    });
  } catch (error) {
    console.error("[portal/nickname-availability] lookup failed:", error);
    return res.status(500).json({
      error: "nickname_lookup_failed",
      message: "Nickname availability could not be checked.",
    });
  }
}

export default withSupportPortalApi(handler);
