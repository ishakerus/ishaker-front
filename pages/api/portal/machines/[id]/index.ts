import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../../lib/portal/auth";
import { updateMachineRegistrationData } from "../../../../../services/server/machineRegistration";
import { requestStrapiRestAsService } from "../../../../../services/server/strapiClient";
import {
  addPortalMachineFields,
  withoutMachineNickname,
} from "../../../../../lib/portal/machinePrivacy";
import type { Currency, Language } from "../../../../../types/strapi";

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const asId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

const hasOwn = (body: unknown, key: string) =>
  Boolean(body && Object.prototype.hasOwnProperty.call(body, key));

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
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

  const countryProvided = hasOwn(req.body, "country");
  const stateProvided = hasOwn(req.body, "state");
  const cityProvided = hasOwn(req.body, "city");
  const currencyProvided = hasOwn(req.body, "currencyId");
  const languageProvided = hasOwn(req.body, "languageId");
  const nayaxProvided = hasOwn(req.body, "nayaxTerminalId");
  if (
    !countryProvided &&
    !stateProvided &&
    !cityProvided &&
    !currencyProvided &&
    !languageProvided &&
    !nayaxProvided
  ) {
    return res.status(400).json({ error: "no_machine_updates" });
  }
  if (nayaxProvided && typeof req.body?.nayaxTerminalId !== "string") {
    return res.status(400).json({ error: "invalid_nayax_terminal_id" });
  }
  const country = countryProvided ? asString(req.body?.country) : machine.country || "";
  const stateRegion = stateProvided
    ? asString(req.body?.state)
    : machine.state_region || "";
  const city = cityProvided ? asString(req.body?.city) : machine.city || "";
  const currencyId = currencyProvided ? asString(req.body?.currencyId) : "";
  const languageId = languageProvided ? asString(req.body?.languageId) : "";
  const nayaxTerminalId =
    nayaxProvided && typeof req.body?.nayaxTerminalId === "string"
      ? req.body.nayaxTerminalId.trim()
      : undefined;
  if (
    countryProvided &&
    !country
  ) {
    return res.status(400).json({
      error: "missing_location",
      message: "Country cannot be empty.",
    });
  }
  if (nayaxTerminalId && nayaxTerminalId.length > 255) {
    return res.status(400).json({
      error: "invalid_nayax_terminal_id",
      message: "Nayax terminal ID must be 255 characters or fewer.",
    });
  }

  let currency: Currency | null = null;
  if (currencyProvided) {
    currency = currencyId
      ? await requestStrapiRestAsService<Currency>(
          `/api/currencies/${currencyId}`,
        ).catch(() => null)
      : null;
    if (!currency?.id || currency.isActive === false) {
      return res.status(400).json({
        error: "invalid_currency",
        message: "Select an active currency.",
      });
    }
  }

  let language: Language | null = null;
  if (languageProvided) {
    language = languageId
      ? await requestStrapiRestAsService<Language>(
          `/api/languages/${languageId}`,
        ).catch(() => null)
      : null;
    if (!language?.id || language.isActive === false) {
      return res.status(400).json({
        error: "invalid_language",
        message: "Select an active language.",
      });
    }
  }

  try {
    const updatesRegistration =
      countryProvided || stateProvided || cityProvided;
    const responseParams = addPortalMachineFields(new URLSearchParams());
    const updatedMachine = updatesRegistration
      ? await updateMachineRegistrationData({
          client: session.client,
          machine,
          nickname: session.client.company,
          country,
          stateRegion,
          city,
          currencyId: currencyProvided ? currency?.id : undefined,
          languageId: language?.id,
          nayaxTerminalId,
        })
      : await requestStrapiRestAsService(
          `/api/machines/${machine.id}?${responseParams.toString()}`,
          {
            method: "PUT",
            body: JSON.stringify({
              data: {
                ...(currency ? { currency: currency.id } : {}),
                ...(language ? { language: language.id } : {}),
                ...(nayaxProvided
                  ? { nayax_terminal_id: nayaxTerminalId || null }
                  : {}),
              },
            }),
          },
        );
    return res.status(200).json({
      machine: withoutMachineNickname(
        updatedMachine as Record<string, unknown>,
      ),
    });
  } catch (error) {
    console.error("[portal/machines/:id] update failed:", error);
    return res.status(500).json({
      error: "machine_update_failed",
      message: "Machine registration data could not be updated.",
    });
  }
}

export default withSupportPortalApi(handler);
