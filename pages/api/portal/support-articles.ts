import { withSupportPortalApi } from "../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";
import type { Article } from "../../../types/article";

const TOPICS = {
  wifi: ["wifi", "wi-fi", "internet", "network", "connection"],
  nayax: ["nayax", "terminal", "card reader", "payment"],
} as const;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client") {
    return res.status(401).json({ error: "unauthorized" });
  }
  const topic = Array.isArray(req.query.topic) ? req.query.topic[0] : req.query.topic;
  if (!topic || !(topic in TOPICS)) {
    return res.status(400).json({ error: "invalid_topic" });
  }

  try {
    const params = new URLSearchParams({
      "filters[isOutdated][$eq]": "false",
      "fields[0]": "code",
      "fields[1]": "key",
      "fields[2]": "header",
      "fields[3]": "subheader",
      "fields[4]": "article",
      "pagination[pageSize]": "2000",
    });
    const articles = await requestStrapiRestAsService<Article[]>(
      `/api/articles?${params.toString()}`,
    );
    const words = TOPICS[topic as keyof typeof TOPICS];
    const article = articles
      .map((candidate) => {
        const title = `${candidate.code} ${candidate.key || ""} ${candidate.header || ""}`.toLowerCase();
        const body = `${candidate.subheader || ""} ${candidate.article || ""}`.toLowerCase();
        return {
          candidate,
          score: words.reduce(
            (score, word) => score + (title.includes(word) ? 10 : 0) + (body.includes(word) ? 1 : 0),
            0,
          ),
        };
      })
      .sort((left, right) => right.score - left.score)[0];

    return res.status(200).json({
      article: article?.score
        ? {
            code: article.candidate.code,
            title: article.candidate.header || article.candidate.code,
          }
        : null,
    });
  } catch (error) {
    console.error("[portal/support-articles] lookup failed:", error);
    return res.status(500).json({ error: "article_lookup_failed" });
  }
}

export default withSupportPortalApi(handler);
