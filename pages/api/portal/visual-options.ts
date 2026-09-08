import { withSupportPortalApi } from "../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../../lib/portal/splashOwnership";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";
import type { PortalSplash, PortalTaste } from "../../../types/portal";

const PAGE_SIZE = 100;

const loadAllPages = async <T,>(path: string, baseParams: URLSearchParams) => {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams(baseParams);
    params.set("pagination[page]", String(page));
    params.set("pagination[pageSize]", String(PAGE_SIZE));
    const current = await requestStrapiRestAsService<T[]>(
      `${path}?${params.toString()}`,
    );
    items.push(...current);
    if (current.length < PAGE_SIZE) return items;
    page += 1;
  }
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const type = Array.isArray(req.query.type)
    ? req.query.type[0]
    : req.query.type;
  try {
    res.setHeader("Cache-Control", "private, no-store");
    if (type === "splashes") {
      const params = new URLSearchParams();
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
      params.set("sort[0]", "name:ASC");
      const splashes = await requestWithSplashOwnershipFallback(
        params,
        (query) => loadAllPages<PortalSplash>("/api/splashes", query),
        () =>
          console.warn(
            "[portal/visual-options] splash ownership filtering is unsupported; using the compatible query.",
          ),
      );
      return res.status(200).json({ splashes });
    }
    if (type === "tastes") {
      const params = new URLSearchParams();
      params.set("fields[0]", "name");
      params.set("populate[main][fields][0]", "url");
      params.set("populate[main][fields][1]", "formats");
      params.set("sort[0]", "name:ASC");
      const tastes = await loadAllPages<PortalTaste>("/api/tastes", params);
      return res.status(200).json({ tastes });
    }
    return res.status(400).json({ error: "invalid_visual_option_type" });
  } catch (error) {
    console.error("[portal/visual-options] load failed:", error);
    return res.status(500).json({
      error: "visual_options_load_failed",
      message: "All image options could not be loaded.",
    });
  }
}

export default withSupportPortalApi(handler);
