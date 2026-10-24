import type { Client, Machine } from "../../types/strapi";
import { requestStrapiRestAsService } from "./strapiClient";
import { getDefaultMachineTitle } from "../../lib/portal/machineName";
import {
  addPortalMachineFields,
  withoutMachineNickname,
} from "../../lib/portal/machinePrivacy";

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const updateMachineRegistrationData = async (params: {
  client: Pick<Client, "id" | "company">;
  machine: Machine;
  title?: string;
  country: string;
  stateRegion: string;
  city: string;
  currencyId?: string | number;
  languageId?: string | number;
  nayaxTerminalId?: string;
  wrapProductline?: boolean;
}) => {
  const title =
    clean(params.title) ||
    clean(params.machine.title) ||
    getDefaultMachineTitle(params.machine.id, params.machine.machine_type?.name);
  const responseParams = addPortalMachineFields(new URLSearchParams());

  const updatedMachine = await requestStrapiRestAsService<Machine>(
    `/api/machines/${params.machine.id}?${responseParams.toString()}`,
    {
      method: "PUT",
      body: JSON.stringify({
        data: {
          client: params.client.id,
          title,
          country: params.country,
          state_region: params.stateRegion,
          city: params.city,
          ...(params.currencyId ? { currency: params.currencyId } : {}),
          ...(params.languageId ? { language: params.languageId } : {}),
          ...(typeof params.nayaxTerminalId === "string"
            ? { nayax_terminal_id: clean(params.nayaxTerminalId) || null }
            : {}),
          ...(typeof params.wrapProductline === "boolean"
            ? { wrap_productline: params.wrapProductline }
            : {}),
        },
      }),
    },
  );
  return withoutMachineNickname(
    updatedMachine as Machine & Record<string, unknown>,
  ) as Machine;
};
