import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  consumeDoorKeyRateLimit,
  logDoorAccess,
  resolveDoorSerial,
} from "../../../../../lib/portal/doorAccess";
import { buildDoorKey } from "../../../../../lib/portal/doorKey";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../../lib/portal/auth";

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req).catch((error) => {
    console.error("[portal/door-key] session resolution failed:", error);
    return undefined;
  });
  if (session === undefined) {
    return res.status(500).json({ error: "session_unavailable" });
  }
  if (!session || session.access !== "client") {
    return res.status(401).json({ error: "unauthorized" });
  }

  const machineId = idFrom(req.query.id);
  const machine = machineId
    ? await assertMachineBelongsToSessionClient(session, machineId)
    : null;
  if (!machine) return res.status(404).json({ error: "not_found" });
  if (machine.has_door_lock !== true) {
    return res.status(409).json({ error: "no_door_lock" });
  }

  const rateLimit = consumeDoorKeyRateLimit(
    `portal:${session.user.id}:${machine.id}`,
  );
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    return res.status(429).json({ error: "rate_limited" });
  }

  const { serial, serialSource, serialMismatch } = resolveDoorSerial(machine);
  if (!serial) {
    return res.status(409).json({ error: "serial_unavailable" });
  }

  const issuedAt = new Date().toISOString();
  const key = buildDoorKey(serial, { now: new Date(issuedAt) });
  await logDoorAccess({
    req,
    machine,
    serial,
    payload: key.payload,
    issuedVia: "portal",
    issuedAt,
    validUntil: key.validUntil,
    issuedTo: session.user.id,
    issuedToLabel: session.user.email,
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
  });
}

export default withSupportPortalApi(handler);
