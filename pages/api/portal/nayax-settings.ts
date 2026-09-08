import { withSupportPortalApi } from "../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const first = (value: unknown) =>
  Array.isArray(value) ? clean(value[0]) : clean(value);

const safeSettings = (client: {
  nayax_actor_id?: string | null;
  nayax_status?: "unconfigured" | "ok" | "error";
  nayax_error?: string | null;
  nayax_last_sync_at?: string | null;
}) => ({
  actorId: client.nayax_actor_id || "",
  status: client.nayax_status || "unconfigured",
  error: client.nayax_error || null,
  lastSyncAt: client.nayax_last_sync_at || null,
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!["GET", "PUT"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client" || !session.client.id) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const machineId = first(
    req.method === "GET" ? req.query.machineId : req.body?.machineId,
  );
  const machine =
    /^\d+$/.test(machineId)
      ? await assertMachineBelongsToSessionClient(session, machineId)
      : null;
  if (!machine) {
    return res.status(403).json({ error: "machine_access_denied" });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ...safeSettings(session.client),
      machineId: machine.id,
      terminalId: machine.nayax_terminal_id || "",
    });
  }

  const token = clean(req.body?.token);
  const actorId = clean(req.body?.actorId);
  const terminalId = clean(req.body?.terminalId);
  if (
    (!token &&
      actorId === (session.client.nayax_actor_id || "") &&
      terminalId === (machine.nayax_terminal_id || "")) ||
    token.length > 4096 ||
    actorId.length > 255 ||
    !terminalId ||
    terminalId.length > 255
  ) {
    return res.status(400).json({
      error: "invalid_nayax_settings",
      message:
        "Enter a terminal ID and a valid Nayax token or changed actor/terminal value.",
    });
  }

  try {
    let client: any = session.client;
    if (token || actorId !== (session.client.nayax_actor_id || "")) {
      client = await requestStrapiRestAsService(
        `/api/clients/${session.client.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            data: {
              ...(token ? { nayax_token: token } : {}),
              nayax_actor_id: actorId || null,
              ...(token
                ? { nayax_status: "unconfigured", nayax_error: null }
                : {}),
            },
          }),
        },
      );
    }
    await requestStrapiRestAsService(`/api/machines/${machine.id}`, {
      method: "PUT",
      body: JSON.stringify({
        data: { nayax_terminal_id: terminalId },
      }),
    });

    return res.status(200).json({
      saved: true,
      settings: {
        ...safeSettings(client || { nayax_actor_id: actorId }),
        machineId: machine.id,
        terminalId,
      },
    });
  } catch (error) {
    console.error("[portal/nayax-settings] save failed");
    return res.status(500).json({
      error: "nayax_settings_save_failed",
      message: "Nayax settings could not be saved.",
    });
  }
}

export default withSupportPortalApi(handler);
