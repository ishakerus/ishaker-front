import { withSupportPortalApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import {
  applyStoredPowderLevels,
  buildMachineHealthRow,
} from "../../../../lib/portal/machineHealth";
import { applyMachineHealthFixture } from "../../../../lib/portal/machineHealthFixture";
import { matchTelemetryMachineBySerial } from "../../../../lib/portal/telemetrySerial";
import {
  getTelemetryMachineStatus,
  getTelemetryMachineStorage,
  isTelemetryConfigured,
  listTelemetryMachineSerials,
  resolveTelemetryOrganizationId,
} from "../../../../services/server/telemetryClient";
import type { TelemetryHealthInput } from "../../../../types/machineHealth";
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
  const telemetryBySerial = new Map<string, TelemetryHealthInput>();
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

  if (isTelemetryConfigured()) {
    try {
      const organizationId = await resolveTelemetryOrganizationId(session.client);
      if (organizationId) {
        const telemetryMachines = await listTelemetryMachineSerials(organizationId);

        await Promise.all(
          machines.map(async (machine) => {
            const serial = String(machine.serial_number || "").trim();
            const match = matchTelemetryMachineBySerial(telemetryMachines, serial);

            if (!match.machine) {
              if (match.reason === "ambiguous") {
                console.warn(
                  `[portal/machines/health] serial ${serial} matches several cabinet machines, skipped:`,
                  match.candidates,
                );
              }
              return;
            }

            const [status, storage] = await Promise.all([
              getTelemetryMachineStatus(match.machine.id).catch(() => null),
              getTelemetryMachineStorage(match.machine.id).catch(() => null),
            ]);
            telemetryBySerial.set(serial, { status, storage });
          }),
        );
      }
    } catch (error) {
      console.error("[portal/machines/health] telemetry fallback failed:", error);
    }
  }

  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    machines: machines.map((machine) => {
      const row = buildMachineHealthRow(
        machine,
        telemetryBySerial.get(String(machine.serial_number || "").trim()),
      );
      const storedCells = storedCellsByMachineId.get(String(machine.id));
      return storedCells
        ? applyStoredPowderLevels(row, machine, storedCells)
        : row;
    }),
  });
}

export default withSupportPortalApi(handler);
