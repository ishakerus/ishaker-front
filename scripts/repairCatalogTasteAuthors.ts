import { loadEnvConfig } from "@next/env";
import { recoverPortalTasteClient, type RecoverableTaste } from "../lib/portal/tasteAuthorRecovery";
import { requestStrapiRestAsService } from "../services/server/strapiClient";

loadEnvConfig(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const query = new URLSearchParams({
    "populate[author][fields][0]": "company",
    "populate[default_splash][populate][author][fields][0]": "username",
    "populate[default_splash][populate][author][populate][client][fields][0]": "company",
    "populate[default_splash][populate][images][fields][0]": "name",
    "pagination[pageSize]": "100",
    "sort[0]": "id:ASC",
  });
  for (let page = 1; ; page++) {
    query.set("pagination[page]", String(page));
    const tastes = await requestStrapiRestAsService<RecoverableTaste[]>(`/api/tastes?${query}`);
    for (const taste of tastes) {
      const clientId = recoverPortalTasteClient(taste);
      if (!clientId) continue;
      console.log(JSON.stringify({ tasteId: taste.id, name: taste.name, clientId, action: apply ? "restore_author" : "would_restore_author" }));
      if (apply) {
        await requestStrapiRestAsService(`/api/tastes/${taste.id}`, {
          method: "PUT",
          body: JSON.stringify({ data: { author: clientId, isWebsiteVisible: true, submission_status: "approved" } }),
        });
        const saved = await requestStrapiRestAsService<RecoverableTaste>(`/api/tastes/${taste.id}?populate[author][fields][0]=company`);
        if (String(saved.author?.id) !== String(clientId)) throw new Error(`Ownership was not saved for taste ${taste.id}.`);
      }
    }
    if (tastes.length < 100) break;
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
