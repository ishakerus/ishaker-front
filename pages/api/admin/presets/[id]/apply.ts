import { withAdminApi } from "../../../../../lib/admin/access";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../../lib/admin/auth";
import {
  fetchStrapiCatalogEndpoint,
  hasStrapiCatalogToken,
  requestStrapiRestAsService,
} from "../../../../../services/server/strapiClient";
import {
  getDuplicateContainerSlots,
  getMachineContainerCount,
  isValidContainerSlot,
} from "../../../../../lib/portal/containerSlots";

const asId = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = typeof raw === "string" ? raw.trim() : String(raw || "");
  return /^\d+$/.test(id) ? id : "";
};
const nullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

type Cell = {
  id?: string | number;
  position: number;
  cell_category?: "powder" | "concentrate";
  product?: { id: string | number; name?: string } | null;
  price?: number | string | null;
  isActive?: boolean;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const presetId = asId(req.query.id);
  const machineId = asId(req.body?.machineId);
  const mode = req.body?.mode === "replaceAll" ? "replaceAll" : "merge";
  const replacePrices = req.body?.replacePrices === true;
  if (!presetId || !machineId) {
    return res.status(400).json({ error: "invalid_target" });
  }

  try {
    const [preset, machine, presetCells, machineCells]: any[] =
      await Promise.all([
        requestStrapiRestAsService(
          `/api/presets/${presetId}?populate[0]=currency&populate[1]=language&populate[2]=machine_type`,
        ),
        requestStrapiRestAsService(
          `/api/machines/${machineId}?fields[0]=serial_number&populate[0]=currency&populate[1]=language&populate[2]=machine_type`,
        ),
        requestStrapiRestAsService(
          `/api/preset-cells?filters[preset][id][$eq]=${presetId}&populate[product]=*&sort[0]=position:ASC&pagination[pageSize]=2000`,
        ),
        requestStrapiRestAsService(
          `/api/machine-cells?filters[machine][id][$eq]=${machineId}&populate[product]=*&sort[0]=position:ASC&pagination[pageSize]=2000`,
        ),
      ]);

    if (!preset?.id || !machine?.id) {
      return res.status(404).json({ error: "preset_or_machine_not_found" });
    }
    if (
      preset.machine_type?.id &&
      machine.machine_type?.id &&
      String(preset.machine_type.id) !== String(machine.machine_type.id)
    ) {
      return res.status(409).json({
        error: "machine_type_mismatch",
        message: "Preset and target machine types do not match.",
      });
    }
    const containerCount = getMachineContainerCount(preset.machine_type);
    const presetPositions: number[] = presetCells.map((cell: Cell) =>
      Number(cell.position),
    );
    const machinePositions: number[] = machineCells.map((cell: Cell) =>
      Number(cell.position),
    );
    if (
      containerCount === null ||
      presetPositions.some(
        (position: number) =>
          !isValidContainerSlot(position, containerCount),
      ) ||
      getDuplicateContainerSlots(presetPositions).size > 0
    ) {
      return res.status(400).json({
        error: "invalid_preset_container_slots",
        message:
          containerCount === null
            ? "The preset machine model has no powder container count configured."
            : `The preset must use unique physical container slots from 1 to ${containerCount}.`,
      });
    }
    if (
      machinePositions.length > containerCount ||
      machinePositions.some(
        (position: number) =>
          !isValidContainerSlot(position, containerCount),
      ) ||
      getDuplicateContainerSlots(machinePositions).size > 0
    ) {
      return res.status(409).json({
        error: "invalid_machine_container_slots",
        message:
          "The machine has duplicate or invalid container assignments. Repair them before applying a preset.",
      });
    }
    if (!preset.currency?.id || !preset.language?.id) {
      return res.status(400).json({
        error: "preset_defaults_missing",
        message: "Preset must have a currency and language before it can be applied.",
      });
    }

    const existingByPosition = new Map<number, Cell>(
      machineCells.map((cell: Cell) => [Number(cell.position), cell]),
    );
    const listedPositions = new Set<number>(
      presetCells.map((cell: Cell) => Number(cell.position)),
    );
    const operations = presetCells.map((presetCell: Cell) => {
      const existing = existingByPosition.get(Number(presetCell.position));
      const existingPrice = nullableNumber(existing?.price);
      const presetPrice = nullableNumber(presetCell.price);
      const nextPrice =
        existing && !replacePrices && existingPrice !== null
          ? existingPrice
          : presetPrice;
      return {
        action: existing ? "update" : "create",
        position: Number(presetCell.position),
        cellId: existing?.id || null,
        before: existing
          ? {
              productId: existing.product?.id || null,
              productName: existing.product?.name || null,
              cellCategory: existing.cell_category || null,
              price: existingPrice,
              isActive: existing.isActive !== false,
            }
          : null,
        after: {
          productId: presetCell.product?.id || null,
          productName: presetCell.product?.name || null,
          cellCategory: presetCell.cell_category || "powder",
          price: nextPrice,
          isActive: presetCell.isActive !== false,
        },
        priceDecision:
          existing && !replacePrices && existingPrice !== null
            ? "preserved_override"
            : presetPrice === null
              ? "inherit_dosage"
              : "copied_from_preset",
      };
    });
    const deletions =
      mode === "replaceAll"
        ? machineCells
            .filter((cell: Cell) => !listedPositions.has(Number(cell.position)))
            .map((cell: Cell) => ({
              action: "delete",
              position: Number(cell.position),
              cellId: cell.id,
              before: {
                productId: cell.product?.id || null,
                productName: cell.product?.name || null,
                cellCategory: cell.cell_category || null,
                price: nullableNumber(cell.price),
                isActive: cell.isActive !== false,
              },
              after: null,
            }))
        : [];
    const diff = {
      preset: { id: preset.id, name: preset.name },
      machine: { id: machine.id, serial_number: machine.serial_number },
      mode,
      replacePrices,
      settings: {
        currency: {
          before: machine.currency || null,
          after: preset.currency,
        },
        language: {
          before: machine.language || null,
          after: preset.language,
        },
      },
      cells: [...operations, ...deletions],
    };
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(diff))
      .digest("hex");

    if (req.body?.confirm !== true) {
      return res.status(200).json({ preview: true, hash, diff });
    }
    if (req.body?.expectedHash !== hash) {
      return res.status(409).json({
        error: "preset_diff_changed",
        message: "The machine changed after preview. Review the new diff before applying.",
        hash,
        diff,
      });
    }

    if (deletions.length) return res.status(403).json({ error: "support_cannot_delete", message: "Applying this preset would remove existing containers. Support can only create or update them." });

    await requestStrapiRestAsService(`/api/machines/${machineId}`, {
      method: "PUT",
      body: JSON.stringify({
        data: {
          currency: preset.currency.id,
          language: preset.language.id,
          preset: preset.id,
        },
      }),
    });
    for (const operation of operations) {
      await requestStrapiRestAsService(
        operation.cellId
          ? `/api/machine-cells/${operation.cellId}`
          : "/api/machine-cells",
        {
          method: operation.cellId ? "PUT" : "POST",
          body: JSON.stringify({
            data: {
              ...(!operation.cellId ? { machine: Number(machineId) } : {}),
              position: operation.position,
              product: operation.after.productId,
              cell_category: operation.after.cellCategory,
              price: operation.after.price,
              isActive: operation.after.isActive,
            },
          }),
        },
      );
    }
    for (const deletion of deletions) {
      await requestStrapiRestAsService(
        `/api/machine-cells/${deletion.cellId}`,
        { method: "DELETE" },
      );
    }

    let planogram = null;
    let planogramStatus = null;
    let planogramSource = null;
    if (machine.serial_number && hasStrapiCatalogToken()) {
      const validationResponse = await fetchStrapiCatalogEndpoint(
        `/api/machines/${encodeURIComponent(machine.serial_number)}/planogram`,
      );
      planogramStatus = validationResponse.status;
      planogramSource = validationResponse.headers.get("x-planogram-source");
      planogram = await validationResponse.json().catch(() => null);
    }

    return res.status(200).json({
      applied: true,
      hash,
      diff,
      planogram,
      planogramStatus,
      planogramSource,
    });
  } catch (error) {
    console.error("[admin/presets/:id/apply] failed:", error);
    return res.status(500).json({
      error: "preset_apply_failed",
      message: "Preset could not be applied.",
    });
  }
}

export default withAdminApi(handler);
