import { withSupportPortalApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import {
  applyStoredPowderLevels,
  buildMachineHealthRow,
} from "../../../../lib/portal/machineHealth";
import { applyMachineHealthFixture } from "../../../../lib/portal/machineHealthFixture";
import { getMachineCells } from "../../../../services/server/machineCells";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client" || !session.client.id) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const machines = applyMachineHealthFixture(session.machines);
  const storedCellsByMachineId = new Map<
    string,
    Awaited<ReturnType<typeof getMachineCells>>
  >();

  await Promise.all(
    machines.map(async (machine) => {
      try {
        storedCellsByMachineId.set(
          String(machine.id),
          await getMachineCells(machine.id),
        );
      } catch (error) {
        console.error(
          `[portal/machines/health] stored containers for machine ${machine.id} failed:`,
          error,
        );
      }
    }),
  );

  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    machines: machines.map((machine) => {
      const row = buildMachineHealthRow(machine);
      const storedCells = storedCellsByMachineId.get(String(machine.id));
      return storedCells
        ? {
            ...applyStoredPowderLevels(row, machine, storedCells),
            cells: storedCells,
          }
        : row;
    }),
  });
}

export default withSupportPortalApi(handler);
