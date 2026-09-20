import type { Client, Machine, MachineLookupResponse } from "../../types/strapi";

const PORTAL_MACHINE_FIELDS = [
  "status",
  "title",
  "hostname",
  "description",
  "context",
  "anydesk_id",
  "tailscale_ip",
  "tailscale_hostname",
  "ssh_user",
  "ssh_port",
  "serial_number",
  "unity_version",
  "ssd_version",
  "last_seen_at",
  "country",
  "state_region",
  "city",
  "rustdesk_id",
  "rustdesk_password",
  "telemetry_reg_code",
  "fleet_status",
  "nayax_terminal_id",
  "controller_fw",
  "controller_fw_status",
  "readiness",
  "health",
  "has_door_lock",
  "wrap_productline",
] as const;

const PORTAL_MACHINE_INVENTORY_FIELDS = [
  "water_type",
  "water_amount_liters",
  "cups_amount",
] as const;

export const addPortalMachineFields = (
  params: URLSearchParams,
  keyPrefix = "fields",
  includeInventory = false,
) => {
  const fields = includeInventory
    ? [...PORTAL_MACHINE_FIELDS, ...PORTAL_MACHINE_INVENTORY_FIELDS]
    : PORTAL_MACHINE_FIELDS;
  fields.forEach((field, index) =>
    params.set(`${keyPrefix}[${index}]`, field),
  );
  return params;
};

export const withoutMachineNickname = <T extends Record<string, unknown>>(
  machine: T,
) => {
  const { nickname: _nickname, ...safeMachine } = machine;
  return safeMachine;
};

/**
 * The serial lookup is public because it starts registration. Never return an
 * already-owned machine unless the current portal session owns it, and only
 * expose the handful of fields required by the registration screens.
 */
export const registrationSafeMachineLookup = (
  result: MachineLookupResponse,
  sessionClient?: Pick<Client, "id" | "company"> | null,
): MachineLookupResponse => {
  const machine = result.machine;
  if (!machine?.id) return { machine: null, client: null };

  const ownerId = machine.client?.id || result.client?.id;
  if (
    ownerId &&
    (!sessionClient?.id || String(ownerId) !== String(sessionClient.id))
  ) {
    // Indistinguishable from an unknown serial to avoid machine/account
    // enumeration by unauthenticated callers or other tenants.
    return { machine: null, client: null };
  }

  const safeMachine: Machine = {
    id: machine.id,
    serial_number: machine.serial_number,
    ...(machine.title ? { title: machine.title } : {}),
    ...(machine.machine_type
      ? {
          machine_type: {
            id: machine.machine_type.id,
            ...(machine.machine_type.name
              ? { name: machine.machine_type.name }
              : {}),
          },
        }
      : {}),
    ...(ownerId && sessionClient
      ? {
          client: {
            id: sessionClient.id,
            company: sessionClient.company,
          },
        }
      : { client: null }),
  };

  return {
    machine: safeMachine,
    client:
      ownerId && sessionClient
        ? ({ id: sessionClient.id, company: sessionClient.company } as Client)
        : null,
  };
};
