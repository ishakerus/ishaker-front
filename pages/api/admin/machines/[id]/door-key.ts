import { withAdminApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../../lib/admin/auth";
import {
  consumeDoorKeyRateLimit,
  logDoorAccess,
  resolveDoorSerial,
} from "../../../../../lib/portal/doorAccess";
import { buildDoorKey } from "../../../../../lib/portal/doorKey";
import { requestStrapiRestAsService } from "../../../../../services/server/strapiClient";
import type { Machine } from "../../../../../types/strapi";

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const machineId = idFrom(req.query.id);
  if (!machineId) return res.status(400).json({ error: "invalid_machine" });
  const dayOffset = req.body?.day_offset ?? 0;
  if (![-1, 0, 1].includes(dayOffset)) {
    return res.status(400).json({ error: "invalid_day_offset" });
  }

  let machine: Machine;
  try {
    machine = await requestStrapiRestAsService<Machine>(
      `/api/machines/${machineId}`,
    );
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return res.status(404).json({ error: "not_found" });
    }
    console.error("[admin/door-key] machine load failed:", error);
    return res.status(500).json({ error: "machine_load_failed" });
  }

  const rateLimit = consumeDoorKeyRateLimit(`admin:${machine.id}`);
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    return res.status(429).json({ error: "rate_limited" });
  }

  const { serial, serialSource, serialMismatch } = resolveDoorSerial(machine);
  if (!serial) {
    return res.status(409).json({ error: "serial_unavailable" });
  }

  const issuedAt = new Date().toISOString();
  const key = buildDoorKey(serial, {
    dayOffset,
    now: new Date(issuedAt),
  });
  await logDoorAccess({
    req,
    machine,
    serial,
    payload: key.payload,
    issuedVia: "admin",
    issuedAt,
    validUntil: key.validUntil,
    issuedToLabel: "admin@ishaker",
  });

  return res.status(200).json({
    payload: key.payload,
    serial: key.serial,
    mode: "oneday",
    issued_at: issuedAt,
    valid_until: key.validUntil,
    serial_source: serialSource,
    serial_mismatch: serialMismatch,
    scanner_ok: machine.fleet_status?.scanner_ok ?? null,
    has_door_lock: machine.has_door_lock ?? null,
  });
}

export default withAdminApi(handler);
