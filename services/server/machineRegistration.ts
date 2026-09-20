import type { Client, Machine } from "../../types/strapi";
import { capitalize } from "../helper";
import { requestStrapiRestAsService } from "./strapiClient";
import {
  addPortalMachineFields,
  withoutMachineNickname,
} from "../../lib/portal/machinePrivacy";

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const getMachineTypeLabel = (machine: Machine) => {
  const withoutShaker = clean(machine.machine_type?.name)
    .replace(/\bi?shaker\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutShaker || "Machine";
};

export const getMachineOwnerIndex = async (
  clientId: string | number,
  machineId: string | number,
) => {
  const params = new URLSearchParams();
  params.set("filters[client][id][$eq]", String(clientId));
  params.set("fields[0]", "id");
  params.set("fields[1]", "title");
  params.set("sort[0]", "id:ASC");
  params.set("pagination[pageSize]", "2000");
  const machines = await requestStrapiRestAsService<Machine[]>(
    `/api/machines?${params.toString()}`,
  );
  const currentMachine = machines.find(
    (machine) => String(machine.id) === String(machineId),
  );
  const existingIndex = currentMachine?.title?.match(/\s(\d+)$/)?.[1];
  if (existingIndex) return Number(existingIndex);

  const usedIndexes = new Set(
    machines
      .map((machine) => machine.title?.match(/\s(\d+)$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number),
  );
  let nextIndex = 1;
  while (usedIndexes.has(nextIndex)) nextIndex += 1;
  return nextIndex;
};

export const updateMachineRegistrationData = async (params: {
  client: Pick<Client, "id" | "company">;
  machine: Machine;
  nickname: string;
  country: string;
  stateRegion: string;
  city: string;
  currencyId?: string | number;
  languageId?: string | number;
  nayaxTerminalId?: string;
  wrapProductline?: boolean;
}) => {
  const index = await getMachineOwnerIndex(params.client.id, params.machine.id);
  const title =
    `${params.stateRegion ? `${params.stateRegion.toUpperCase()} • ` : ""}${capitalize(params.nickname)}'s iShaker ${getMachineTypeLabel(
      params.machine,
    ).toUpperCase()} #${index}`
      .replace(/\s+/g, " ")
      .trim();
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
