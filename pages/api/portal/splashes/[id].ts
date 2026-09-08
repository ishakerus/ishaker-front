import { withSupportPortalApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../../../lib/portal/splashOwnership";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type { PortalSplash } from "../../../../types/portal";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: "invalid_splash_id" });
  }

  try {
    const params = new URLSearchParams();
    params.set("filters[id][$eq]", id);
    params.set("filters[$or][0][author][username][$eq]", "root");
    params.set(
      "filters[$or][1][author][id][$eq]",
      String(session.user.id),
    );
    params.set("fields[0]", "name");
    params.set("fields[1]", "color");
    params.set("fields[2]", "isEmpty");
    params.set("populate[images][fields][0]", "url");
    params.set("populate[images][fields][1]", "formats");
    params.set("populate[images][fields][2]", "name");

    params.set("pagination[pageSize]", "1");
    const request = (query: URLSearchParams) =>
      requestStrapiRestAsService<PortalSplash[]>(
        `/api/splashes?${query.toString()}`,
      );
    const splashes = await requestWithSplashOwnershipFallback(
      params,
      request,
      () =>
        console.warn(
          "[portal/splashes] ownership filtering is unsupported; using the compatible query.",
        ),
    );
    const splash = splashes[0];
    if (!splash) return res.status(404).json({ error: "splash_not_found" });

    return res.status(200).json({ splash });
  } catch (error) {
    console.error("[portal/splashes] loading failed:", error);
    return res.status(404).json({ error: "splash_not_found" });
  }
}

export default withSupportPortalApi(handler);
