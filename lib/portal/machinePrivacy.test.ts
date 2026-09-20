import assert from "node:assert/strict";
import test from "node:test";
import {
  addPortalMachineFields,
  registrationSafeMachineLookup,
  withoutMachineNickname,
} from "./machinePrivacy";
import type { MachineLookupResponse } from "../../types/strapi";

const sensitiveLookup: MachineLookupResponse = {
  machine: {
    id: 41,
    serial_number: "25081725-secret-suffix",
    title: "Lobby machine",
    anydesk_id: "123456789",
    rustdesk_password: "do-not-leak",
    tailscale_ip: "100.64.0.4",
    health: { at: "2026-08-31T00:00:00Z" },
    machine_type: { id: 2, name: "Shaker Touch" },
    client: { id: 9, company: "Other Tenant" },
  },
  client: { id: 9, company: "Other Tenant", portal_email: "owner@example.com" },
};

test("portal machine queries never request the nickname field", () => {
  const params = addPortalMachineFields(new URLSearchParams());
  const requestedFields = Array.from(params.values());

  assert.equal(requestedFields.includes("nickname"), false);
  assert.equal(requestedFields.includes("title"), true);
  assert.equal(requestedFields.includes("serial_number"), true);
  assert.equal(requestedFields.includes("wrap_productline"), true);
});

test("portal machine payloads discard a nickname returned by an older API", () => {
  assert.deepEqual(
    withoutMachineNickname({ id: 7, title: "Machine 7", nickname: "hidden" }),
    { id: 7, title: "Machine 7" },
  );
});

test("public registration lookup hides another tenant's machine", () => {
  assert.deepEqual(registrationSafeMachineLookup(sensitiveLookup), {
    machine: null,
    client: null,
  });
  assert.deepEqual(
    registrationSafeMachineLookup(sensitiveLookup, {
      id: 10,
      company: "Current Tenant",
    }),
    { machine: null, client: null },
  );
});

test("registration lookup returns only safe fields for the owning tenant", () => {
  const result = registrationSafeMachineLookup(sensitiveLookup, {
    id: 9,
    company: "Other Tenant",
  });

  assert.deepEqual(result, {
    machine: {
      id: 41,
      serial_number: "25081725-secret-suffix",
      title: "Lobby machine",
      machine_type: { id: 2, name: "Shaker Touch" },
      client: { id: 9, company: "Other Tenant" },
    },
    client: { id: 9, company: "Other Tenant" },
  });
  assert.equal("rustdesk_password" in (result.machine || {}), false);
  assert.equal("tailscale_ip" in (result.machine || {}), false);
  assert.equal("health" in (result.machine || {}), false);
});

test("registration lookup exposes only safe fields for an unassigned machine", () => {
  const result = registrationSafeMachineLookup({
    machine: {
      ...sensitiveLookup.machine!,
      client: null,
    },
    client: null,
  });

  assert.equal(result.machine?.id, 41);
  assert.equal(result.machine?.client, null);
  assert.equal(result.client, null);
  assert.equal("anydesk_id" in (result.machine || {}), false);
});
