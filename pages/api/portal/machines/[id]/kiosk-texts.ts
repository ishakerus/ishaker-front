import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../../../../services/server/strapiClient";
import { addPortalMachineFields } from "../../../../../lib/portal/machinePrivacy";
import type {
  Language,
  Machine,
  TranslationSet,
} from "../../../../../types/strapi";

type Translation = {
  id: string | number;
  key: string;
  namespace?: string | null;
  file?: string | null;
  default_value?: string | null;
  usage?: string | null;
  audience?: string | null;
  sort_order?: number | null;
};

type TranslationEntry = {
  id: string | number;
  translation?: Translation | null;
  value?: string | null;
  status?: string | null;
};

type LocalizationMachine = Machine & {
  language?: Language | null;
  translation_set?: TranslationSet | null;
};

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

const machineWithLocalization = async (machineId: string | number) => {
  const params = new URLSearchParams();
  addPortalMachineFields(params);
  params.set("populate[language]", "*");
  params.set("populate[translation_set][populate][language]", "*");
  params.set("populate[translation_set][populate][client]", "*");
  params.set("populate[translation_set][populate][based_on]", "*");
  return requestStrapiRestAsService<LocalizationMachine>(
    `/api/machines/${machineId}?${params.toString()}`,
  );
};

const rootSetForLanguage = async (languageId: string | number) => {
  const params = new URLSearchParams();
  params.set("filters[is_root][$eq]", "true");
  params.set("filters[language][id][$eq]", String(languageId));
  params.set("populate[language]", "*");
  params.set("pagination[pageSize]", "2");
  const sets = await requestStrapiRestAsService<TranslationSet[]>(
    `/api/translation-sets?${params.toString()}`,
  );
  return sets[0] || null;
};

const entriesForSet = async (setId: string | number) => {
  const params = new URLSearchParams();
  params.set("filters[translation_set][id][$eq]", String(setId));
  params.set("populate[translation]", "*");
  params.set("pagination[pageSize]", "2000");
  return requestStrapiRestAsService<TranslationEntry[]>(
    `/api/translation-entries?${params.toString()}`,
  );
};

const customerTranslations = async () => {
  const params = new URLSearchParams();
  params.set("filters[audience][$eq]", "customer");
  params.set("filters[isActive][$ne]", "false");
  params.set("sort[0]", "sort_order:ASC");
  params.set("sort[1]", "key:ASC");
  params.set("pagination[pageSize]", "2000");
  return requestStrapiRestAsService<Translation[]>(
    `/api/translations?${params.toString()}`,
  );
};

const loadPayload = async (machineId: string | number) => {
  const machine = await machineWithLocalization(machineId);
  const language = machine.language || null;
  const set = machine.translation_set || null;
  const rootSet = language?.id ? await rootSetForLanguage(language.id) : null;
  const [translations, rootEntries, customEntries] = await Promise.all([
    customerTranslations(),
    rootSet?.id ? entriesForSet(rootSet.id) : Promise.resolve([]),
    set?.id && set.is_root !== true
      ? entriesForSet(set.id)
      : Promise.resolve([]),
  ]);
  const rootValues = new Map(
    rootEntries
      .filter((entry) => entry.translation?.id)
      .map((entry) => [String(entry.translation!.id), entry.value || ""]),
  );
  const languageMismatch = Boolean(
    set?.id && String(set.language?.id || "") !== String(language?.id || ""),
  );

  return {
    machine: { id: machine.id, title: machine.title },
    language,
    translation_set: set,
    root_set: rootSet,
    language_mismatch: languageMismatch,
    translations: translations.map((translation) => ({
      ...translation,
      root_value:
        rootValues.get(String(translation.id)) ??
        translation.default_value ??
        "",
    })),
    entries: customEntries.map((entry) => ({
      id: entry.id,
      translation_id: entry.translation?.id,
      value: entry.value || "",
      status: entry.status || "approved",
    })),
  };
};

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST", "PUT"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client") {
    return res.status(401).json({ error: "unauthorized" });
  }
  const machineId = idFrom(req.query.id);
  const ownedMachine = machineId
    ? await assertMachineBelongsToSessionClient(session, machineId)
    : null;
  if (!ownedMachine) return res.status(404).json({ error: "not_found" });

  try {
    if (req.method === "GET") {
      return res.status(200).json(await loadPayload(machineId));
    }

    const machine = await machineWithLocalization(machineId);
    const language = machine.language;
    if (!language?.id || language.isActive === false) {
      return res.status(409).json({
        error: "language_required",
        message: "Choose an active machine language before customizing texts.",
      });
    }

    if (req.method === "POST") {
      const rootSet = await rootSetForLanguage(language.id);
      if (!rootSet?.id) {
        return res.status(409).json({
          error: "root_set_missing",
          message: `No default text pack exists for ${language.name}.`,
        });
      }

      const slug = slugify(
        `${session.client.company}-${language.code}-${machine.id}`,
      );
      const params = new URLSearchParams();
      params.set("filters[slug][$eq]", slug);
      params.set("populate[client]", "*");
      params.set("populate[language]", "*");
      params.set("pagination[pageSize]", "2");
      const existingSets = await requestStrapiRestAsService<TranslationSet[]>(
        `/api/translation-sets?${params.toString()}`,
      );
      let set = existingSets[0] || null;
      if (
        set &&
        (set.is_root === true ||
          String(set.client?.id || "") !== String(session.client.id) ||
          String(set.language?.id || "") !== String(language.id))
      ) {
        return res.status(409).json({ error: "translation_set_slug_conflict" });
      }
      if (!set) {
        set = await requestStrapiRestAsService<TranslationSet>(
          "/api/translation-sets",
          {
            method: "POST",
            body: JSON.stringify({
              data: {
                name: `${session.client.company} · ${language.name}`,
                slug,
                language: language.id,
                client: session.client.id,
                is_root: false,
                based_on: rootSet.id,
                isActive: true,
              },
            }),
          },
        );
      }
      await requestStrapiRestAsService(`/api/machines/${machine.id}`, {
        method: "PUT",
        body: JSON.stringify({ data: { translation_set: set.id } }),
      });
      return res.status(201).json(await loadPayload(machineId));
    }

    const set = machine.translation_set;
    if (
      !set?.id ||
      set.is_root === true ||
      String(set.client?.id || "") !== String(session.client.id) ||
      String(set.language?.id || "") !== String(language.id)
    ) {
      return res.status(409).json({ error: "editable_translation_set_required" });
    }
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : null;
    if (!changes || !changes.length || changes.length > 365) {
      return res.status(400).json({ error: "invalid_translation_changes" });
    }
    const normalizedChanges: Array<{
      translationId: number;
      value: string | null;
    }> = changes.map((change: any) => ({
      translationId: Number(change?.translationId),
      value: typeof change?.value === "string" ? change.value : null,
    }));
    if (
      normalizedChanges.some(
        (change) => !Number.isInteger(change.translationId) || change.value === null,
      ) ||
      new Set(normalizedChanges.map((change) => change.translationId)).size !==
        normalizedChanges.length
    ) {
      return res.status(400).json({ error: "invalid_translation_changes" });
    }

    const [translations, existingEntries] = await Promise.all([
      customerTranslations(),
      entriesForSet(set.id),
    ]);
    const allowedIds = new Set(translations.map((item) => Number(item.id)));
    if (
      normalizedChanges.some((change) => !allowedIds.has(change.translationId))
    ) {
      return res.status(400).json({ error: "translation_not_customer_editable" });
    }
    const entriesByTranslation = new Map(
      existingEntries
        .filter((entry) => entry.translation?.id)
        .map((entry) => [Number(entry.translation!.id), entry]),
    );

    for (const change of normalizedChanges) {
      const value = change.value!;
      const existing = entriesByTranslation.get(change.translationId);
      if (!value.trim()) {
        if (existing) {
          await requestStrapiRestAsService(
            `/api/translation-entries/${existing.id}`,
            { method: "DELETE" },
          );
        }
      } else if (existing) {
        await requestStrapiRestAsService(
          `/api/translation-entries/${existing.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              data: { value, status: "approved" },
            }),
          },
        );
      } else {
        await requestStrapiRestAsService("/api/translation-entries", {
          method: "POST",
          body: JSON.stringify({
            data: {
              translation_set: set.id,
              translation: change.translationId,
              language: language.id,
              value,
              status: "approved",
            },
          }),
        });
      }
    }

    return res.status(200).json(await loadPayload(machineId));
  } catch (error) {
    console.error("[portal/kiosk-texts] request failed:", error);
    return res.status(500).json({
      error: "kiosk_texts_request_failed",
      message: "Kiosk texts could not be updated.",
    });
  }
}

export default withSupportPortalApi(handler);
