import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../../lib/portal/auth";
import {
  createMachineCell,
  deleteMachineCell,
  getMachineCatalogProducts,
  getMachineCells,
  updateMachineCell,
} from "../../../../../services/server/machineCells";
import {
  getMachineContainerCount,
  isValidContainerSlot,
} from "../../../../../lib/portal/containerSlots";
import {
  getProductAssignmentProblems,
} from "../../../../../lib/portal/productAssignment";

type Assignment = {
  cellId: number | null;
  position: number;
  productId: number | null;
  isActive: boolean;
  cellCategory: "powder" | "concentrate";
  amountKg: number;
};

const asId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

const parseAssignments = (value: unknown): Assignment[] | null => {
  if (!Array.isArray(value) || value.length > 200) return null;

  const assignments = value.map((item) => {
    const row = item && typeof item === "object" ? item : {};
    const rawCellId = (row as { cellId?: unknown }).cellId;
    const cellId =
      rawCellId === null || rawCellId === undefined
        ? null
        : Number(rawCellId);
    const position = Number((row as { position?: unknown }).position);
    const rawProductId = (row as { productId?: unknown }).productId;
    const productId = rawProductId === null ? null : Number(rawProductId);
    const isActive = (row as { isActive?: unknown }).isActive;
    const cellCategory = (row as { cellCategory?: unknown }).cellCategory;
    const amountKg = Number((row as { amountKg?: unknown }).amountKg ?? 0);
    return { cellId, position, productId, isActive, cellCategory, amountKg };
  });

  if (
    assignments.some(
      (assignment) =>
        (assignment.cellId !== null &&
          (!Number.isInteger(assignment.cellId) || assignment.cellId <= 0)) ||
        !Number.isInteger(assignment.position) ||
        assignment.position <= 0 ||
        (assignment.productId !== null &&
          (!Number.isInteger(assignment.productId) || assignment.productId <= 0)) ||
        typeof assignment.isActive !== "boolean" ||
        !Number.isFinite(assignment.amountKg) ||
        assignment.amountKg < 0 ||
        (typeof assignment.cellCategory !== "string" ||
          !["powder", "concentrate"].includes(assignment.cellCategory)),
    )
  ) {
    return null;
  }

  if (new Set(assignments.map((assignment) => assignment.position)).size !== assignments.length) {
    return null;
  }

  return assignments as Assignment[];
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client") {
    return res.status(401).json({ error: "unauthorized" });
  }

  const machineId = asId(req.query.id);
  const machine = machineId
    ? await assertMachineBelongsToSessionClient(session, machineId)
    : null;
  if (!machine) {
    return res.status(403).json({ error: "machine_access_denied" });
  }

  try {
    const cells = await getMachineCells(machineId);
    if (req.method === "GET") return res.status(200).json(cells);

    if (req.method === "DELETE") {
      const cellId = Number(req.body?.cellId);
      const cell = cells.find((item) => Number(item.id) === cellId);
      if (!cell) {
        return res.status(404).json({ error: "machine_cell_not_found" });
      }
      await deleteMachineCell(cell.id);
      return res.status(200).json({
        deleted: true,
        cellId: cell.id,
        cells: await getMachineCells(machineId),
      });
    }

    const containerCount = getMachineContainerCount(machine.machine_type);
    if (containerCount === null) {
      return res.status(409).json({
        error: "container_count_not_configured",
        message:
          "This machine model has no powder container count configured.",
      });
    }
    const maxAmountKg = containerCount === 8 ? 2 : 1;
    if (
      ["POST", "PUT"].includes(req.method || "") &&
      cells.some((cell) => cell.amount_kg === undefined)
    ) {
      return res.status(503).json({
        error: "powder_amount_storage_unavailable",
        message:
          "Powder amount storage is not active yet. Deploy and restart Strapi before saving assignments.",
      });
    }

    if (req.method === "POST") {
      const assignments = parseAssignments([req.body]);
      const assignment = assignments?.[0];
      if (!assignment) {
        return res.status(400).json({
          error: "invalid_machine_cell",
          message: "Enter a valid position, category, product, and active state.",
        });
      }
      if (assignment.position > containerCount) {
        return res.status(400).json({
          error: "invalid_container_slot",
          message: `Choose a physical container slot from 1 to ${containerCount}.`,
        });
      }
      if (assignment.amountKg > maxAmountKg) {
        return res.status(400).json({
          error: "invalid_powder_amount",
          message: `Powder amount must be between 0 and ${maxAmountKg} kg.`,
        });
      }
      if (cells.length >= containerCount) {
        return res.status(409).json({
          error: "container_capacity_reached",
          message: `This machine model has exactly ${containerCount} physical container slots.`,
        });
      }
      if (cells.some((cell) => cell.position === assignment.position)) {
        return res.status(409).json({
          error: "duplicate_position",
          message: `Container position ${assignment.position} already exists.`,
        });
      }
      if (assignment.productId !== null) {
        const products = await getMachineCatalogProducts(machineId, session.client.id);
        const product = products.find(
          (item) => String(item.id) === String(assignment.productId),
        );
        if (!product) {
          return res.status(400).json({ error: "product_not_in_catalog" });
        }
        const productProblems = getProductAssignmentProblems(product);
        if (productProblems.length) {
          return res.status(400).json({
            error: productProblems[0].code,
            message: productProblems[0].detail,
          });
        }
        if (product.product_type !== assignment.cellCategory) {
          return res.status(400).json({ error: "category_mismatch" });
        }
        if (
          assignment.isActive &&
          cells.some(
            (cell) =>
              cell.isActive &&
              String(cell.product?.id) === String(assignment.productId),
          )
        ) {
          return res.status(400).json({
            error: "duplicate_active_product",
            message: "A product cannot be assigned to two active containers.",
          });
        }
      }
      await createMachineCell({
        machineId,
        ...assignment,
        price: null,
      });
      return res.status(201).json(await getMachineCells(machineId));
    }

    const assignments = parseAssignments(req.body?.assignments);
    if (!assignments) {
      return res.status(400).json({
        error: "invalid_assignments",
        message: "Assignments must contain valid, unique container positions.",
      });
    }
    if (
      assignments.some(
        (assignment) =>
          assignment.position > containerCount ||
          assignment.amountKg > maxAmountKg,
      )
    ) {
      return res.status(400).json({
        error: "invalid_container_assignment",
        message: `Every container must use slots 1 through ${containerCount} and an amount from 0 to ${maxAmountKg} kg.`,
      });
    }

    const persistedIds = assignments
      .map((assignment) => assignment.cellId)
      .filter((id): id is number => id !== null);
    if (new Set(persistedIds).size !== persistedIds.length) {
      return res.status(400).json({
        error: "invalid_machine_cells",
        message: "Each saved container must have a unique cell ID.",
      });
    }

    const positionCounts = new Map<number, number>();
    cells.forEach((cell) =>
      positionCounts.set(
        cell.position,
        (positionCounts.get(cell.position) || 0) + 1,
      ),
    );
    const omittedCells = cells.filter(
      (cell) => !persistedIds.includes(Number(cell.id)),
    );
    const staleOmittedCell = omittedCells.find(
      (cell) =>
        isValidContainerSlot(cell.position, containerCount) &&
        (positionCounts.get(cell.position) || 0) === 1,
    );
    if (staleOmittedCell) {
      return res.status(409).json({
        error: "stale_machine_cells",
        message:
          "Container assignments changed after this page loaded. Reload and try again.",
      });
    }

    const cellsById = new Map(
      cells.map((cell) => [Number(cell.id), cell]),
    );
    const unknownCell = assignments.find(
      (assignment) =>
        assignment.cellId !== null && !cellsById.has(assignment.cellId),
    );
    if (unknownCell) {
      return res.status(403).json({
        error: "machine_cell_access_denied",
        message: "A container does not belong to this machine.",
      });
    }

    const products = await getMachineCatalogProducts(machineId, session.client.id);
    const productsById = new Map(products.map((product) => [String(product.id), product]));
    for (const assignment of assignments) {
      if (assignment.productId === null) continue;

      const product = productsById.get(String(assignment.productId));
      if (!product) {
        return res.status(400).json({
          error: "product_not_in_catalog",
          message: `Product ${assignment.productId} is not in this machine's catalog.`,
        });
      }

      const productProblems = getProductAssignmentProblems(product);
      if (productProblems.length) {
        return res.status(400).json({
          error: productProblems[0].code,
          message: `Container ${assignment.position}: ${productProblems[0].detail}`,
        });
      }

      if (product.product_type !== assignment.cellCategory) {
        return res.status(400).json({
          error: "category_mismatch",
          message: `Container ${assignment.position} requires a ${assignment.cellCategory} product.`,
        });
      }
    }

    // Remove hidden legacy duplicates/out-of-range rows before updating the
    // selected physical slots, so the model-level uniqueness guard can pass.
    await Promise.all(omittedCells.map((cell) => deleteMachineCell(cell.id)));

    await Promise.all(
      assignments.map((assignment) => {
        if (assignment.cellId !== null) {
          const cell = cellsById.get(assignment.cellId)!;
          if (assignment.productId === null) return deleteMachineCell(cell.id);
          return updateMachineCell(
            cell.id,
            assignment.position,
            assignment.productId,
            assignment.isActive,
            null,
            assignment.cellCategory,
            assignment.amountKg,
          );
        }
        if (assignment.productId === null) return Promise.resolve();
        return createMachineCell({ machineId, ...assignment, price: null });
      }),
    );

    const refreshedCells = await getMachineCells(machineId);
    return res.status(200).json(refreshedCells);
  } catch (error) {
    console.error("[portal/machines/:id/cells] request failed:", error);
    return res.status(500).json({
      error: "machine_cells_request_failed",
      message: "Machine containers could not be updated.",
    });
  }
}

export default withSupportPortalApi(handler);
