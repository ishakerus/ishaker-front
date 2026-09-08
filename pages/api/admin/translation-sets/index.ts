import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

const loadAllEntrySetLinks = async () => {
  const pageSize = 2000;
  const entries: any[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await requestStrapiRestAsService<any[]>(
      `/api/translation-entries?fields[0]=id&populate[translation_set][fields][0]=id&pagination[page]=${page}&pagination[pageSize]=${pageSize}`,
    );
    entries.push(...batch);
    if (batch.length < pageSize) return entries;
  }
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const [sets, entries, machines] = await Promise.all([
      requestStrapiRestAsService<any[]>(
        "/api/translation-sets?populate[language]=*&populate[client]=*&populate[based_on][populate][language]=*&sort[0]=is_root:DESC&sort[1]=name:ASC&pagination[pageSize]=2000",
      ),
      loadAllEntrySetLinks(),
      requestStrapiRestAsService<any[]>(
        "/api/machines?fields[0]=id&fields[1]=serial_number&populate[translation_set][fields][0]=id&pagination[pageSize]=2000",
      ),
    ]);
    const entryCounts = new Map<string, number>();
    for (const entry of entries) {
      const setId = entry.translation_set?.id;
      if (setId === null || setId === undefined) continue;
      const key = String(setId);
      entryCounts.set(key, (entryCounts.get(key) || 0) + 1);
    }
    const machinesBySet = new Map<string, any[]>();
    for (const machine of machines) {
      const setId = machine.translation_set?.id;
      if (setId === null || setId === undefined) continue;
      const key = String(setId);
      machinesBySet.set(key, [...(machinesBySet.get(key) || []), machine]);
    }

    return res.status(200).json({
      sets: sets.map((set) => ({
        ...set,
        entry_count: entryCounts.get(String(set.id)) || 0,
        machines: machinesBySet.get(String(set.id)) || [],
      })),
    });
  } catch (error) {
    console.error("[admin/translation-sets] load failed:", error);
    return res.status(500).json({ error: "translation_sets_load_failed" });
  }
}

export default withAdminApi(handler);
