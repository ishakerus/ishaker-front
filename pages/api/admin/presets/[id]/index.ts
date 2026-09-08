import { withAdminApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../../services/server/strapiClient";
import {
  arePresetProductsValid,
  arePresetCellSlotsValid,
  getMachineTypeContainerCount,
  parseCells,
} from "../index";

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};
const relationId = (value: unknown) => {
  const id = typeof value === "string" ? value.trim() : "";
  return /^\d+$/.test(id) ? Number(id) : null;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "PUT" && req.method !== "DELETE") {
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const presetId = idFrom(req.query.id);
  if (!presetId) return res.status(400).json({ error: "invalid_preset" });

  try {
    const existingCells: any[] = await requestStrapiRestAsService(
      `/api/preset-cells?filters[preset][id][$eq]=${presetId}&pagination[pageSize]=2000`,
    );

    if (req.method === "DELETE") {
      for (const cell of existingCells) {
        await requestStrapiRestAsService(`/api/preset-cells/${cell.id}`, {
          method: "DELETE",
        });
      }
      await requestStrapiRestAsService(`/api/presets/${presetId}`, {
        method: "DELETE",
      });
      return res.status(200).json({ deleted: true });
    }

    const cells = parseCells(req.body?.cells);
    const machineTypeId = relationId(req.body?.machineTypeId);
    const currencyId = relationId(req.body?.currencyId);
    const languageId = relationId(req.body?.languageId);
    if (
      !req.body?.name?.trim() ||
      !req.body?.slug?.trim() ||
      !machineTypeId ||
      !currencyId ||
      !languageId ||
      !cells
    ) {
      return res.status(400).json({ error: "invalid_preset" });
    }
    const containerCount = await getMachineTypeContainerCount(machineTypeId);
    if (
      containerCount === null ||
      !arePresetCellSlotsValid(cells, containerCount)
    ) {
      return res.status(400).json({
        error: "invalid_container_slot",
        message:
          containerCount === null
            ? "The selected machine model has no powder container count configured."
            : `Every preset cell must use a unique physical container slot from 1 to ${containerCount}.`,
      });
    }
    if (!(await arePresetProductsValid(cells))) {
      return res.status(400).json({
        error: "invalid_preset_products",
        message:
          "Every assigned product must be complete, active, and match its container category.",
      });
    }

    const submittedExistingIds = new Set(cells.map((cell) => cell.cellId));
    if (existingCells.some((cell) => !submittedExistingIds.has(Number(cell.id)))) {
      return res.status(403).json({ error: "support_cannot_delete", message: "Support can edit or disable preset rows, but cannot remove them." });
    }
    if (cells.some((cell) => cell.cellId !== null && !existingCells.some((existing) => Number(existing.id) === cell.cellId))) {
      return res.status(403).json({ error: "preset_cell_access_denied" });
    }

    await requestStrapiRestAsService(`/api/presets/${presetId}`, {
      method: "PUT",
      body: JSON.stringify({
        data: {
          name: req.body.name.trim(),
          slug: req.body.slug.trim(),
          description:
            typeof req.body.description === "string"
              ? req.body.description.trim()
              : "",
          isDefault: req.body.isDefault === true,
          isActive: req.body.isActive !== false,
          is_template: req.body.isTemplate === true,
          machine_type: machineTypeId,
          currency: currencyId,
          language: languageId,
        },
      }),
    });

    const existingById = new Map(
      existingCells.map((cell) => [Number(cell.id), cell]),
    );
    const submittedIds = new Set(
      cells
        .map((cell) => cell.cellId)
        .filter((cellId): cellId is number => cellId !== null),
    );
    if ([...submittedIds].some((cellId) => !existingById.has(cellId))) {
      return res.status(403).json({
        error: "preset_cell_access_denied",
        message: "A preset cell does not belong to this preset.",
      });
    }
    for (const cell of existingCells) {
      if (!submittedIds.has(Number(cell.id))) {
        await requestStrapiRestAsService(`/api/preset-cells/${cell.id}`, {
          method: "DELETE",
        });
      }
    }
    for (const cell of cells) {
      const existing =
        cell.cellId === null ? null : existingById.get(cell.cellId);
      await requestStrapiRestAsService(
        existing ? `/api/preset-cells/${existing.id}` : "/api/preset-cells",
        {
          method: existing ? "PUT" : "POST",
          body: JSON.stringify({
            data: {
              ...(!existing ? { preset: Number(presetId) } : {}),
              position: cell.position,
              cell_category: cell.cellCategory,
              product: cell.productId,
              price: cell.price,
              isActive: cell.isActive,
            },
          }),
        },
      );
    }
    return res.status(200).json({ updated: true });
  } catch (error) {
    console.error("[admin/presets/:id] request failed:", error);
    return res.status(500).json({ error: "preset_request_failed" });
  }
}

export default withAdminApi(handler);
