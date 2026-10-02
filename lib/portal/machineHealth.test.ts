import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStoredPowderLevels,
  buildMachineHealthRow,
} from "./machineHealth";
import type { Machine } from "../../types/strapi";

const NOW = Date.parse("2026-08-18T17:12:00Z");

const machineWith = (app: NonNullable<Machine["health"]>["app"]): Machine =>
  ({
    id: 112,
    serial_number: "26041826",
    health: { at: "2026-08-18T17:11:30Z", app },
  }) as unknown as Machine;

test("a kiosk counting frames is Online", () => {
  const row = buildMachineHealthRow(
    machineWith({ uptime_s: 720, frames_ok: true }),
    NOW,
  );
  assert.equal(row.online.label, "Online");
  assert.equal(row.online.state, "ok");
});

test("a kiosk inside its first heartbeat is Starting, not App error", () => {
  // FleetPulse restarts the kiosk itself on every media push; the first heartbeat after a
  // start always reads (+0) because there is no previous sample to subtract from.
  const row = buildMachineHealthRow(
    machineWith({ uptime_s: 60, frames_ok: false, state: "starting" }),
    NOW,
  );
  assert.equal(row.online.label, "Starting");
  assert.equal(row.online.state, "warning");
});

test("counted frames take precedence over a lagging Starting state", () => {
  const row = buildMachineHealthRow(
    machineWith({ uptime_s: 180, frames_ok: true, state: "starting" }),
    NOW,
  );
  assert.equal(row.online.label, "Online");
  assert.equal(row.online.state, "ok");
});

test("positive fleet evidence takes precedence over a transient Starting state", () => {
  const machine = {
    ...machineWith({ uptime_s: 60, frames_ok: false, state: "starting" }),
    fleet_status: { at: "2026-08-18T17:11:00Z", sweep: "ok", ssh_ok: true },
  } as unknown as Machine;

  const row = buildMachineHealthRow(machine, NOW);
  assert.equal(row.online.label, "Online");
  assert.equal(row.online.source, "ops");
});

test("readings written before app.state fall back to uptime", () => {
  const row = buildMachineHealthRow(
    machineWith({ uptime_s: 60, frames_ok: false }),
    NOW,
  );
  assert.equal(row.online.label, "Starting");
  assert.equal(row.online.state, "warning");
});

test("a wedged main thread is still an App error", () => {
  const row = buildMachineHealthRow(
    machineWith({ uptime_s: 1800, frames_ok: false, state: "stalled" }),
    NOW,
  );
  assert.equal(row.online.label, "App error");
  assert.equal(row.online.state, "error");
});

test("no kiosk process at all reads as App down", () => {
  const row = buildMachineHealthRow(
    machineWith({ uptime_s: null, frames_ok: false, state: "down" }),
    NOW,
  );
  assert.equal(row.online.label, "App down");
  assert.equal(row.online.state, "error");
});

test("a stale reading hands the online badge back to fleet_status", () => {
  const machine = {
    id: 112,
    serial_number: "26041826",
    health: {
      at: "2026-08-18T16:00:00Z",
      app: { uptime_s: 60, frames_ok: false, state: "starting" },
    },
    fleet_status: { at: "2026-08-18T17:11:00Z", sweep: "ok", ssh_ok: true },
  } as unknown as Machine;

  const row = buildMachineHealthRow(machine, NOW);
  assert.equal(row.online.label, "Online");
  assert.equal(row.online.source, "ops");
});

test("an offline report preserves the last time the machine was online", () => {
  const machine = {
    id: 112,
    serial_number: "26041826",
    last_seen_at: "2026-08-18T16:42:00Z",
    fleet_status: {
      at: "2026-08-18T17:11:00Z",
      sweep: "error",
      ssh_ok: false,
    },
  } as unknown as Machine;

  const row = buildMachineHealthRow(machine, NOW);
  assert.equal(row.online.label, "Offline");
  assert.equal(row.online.at, "2026-08-18T17:11:00Z");
  assert.equal(row.online.lastOnlineAt, "2026-08-18T16:42:00Z");
});

test("a fresh failed SSH sweep reports Offline", () => {
  const machine = {
    id: 118,
    serial_number: "002",
    last_seen_at: "2026-08-18T16:42:00Z",
    fleet_status: {
      at: "2026-08-18T17:11:00Z",
      sweep: "unreachable",
      ssh_ok: false,
    },
  } as unknown as Machine;

  const row = buildMachineHealthRow(machine, NOW);
  assert.equal(row.online.label, "Offline");
  assert.equal(row.online.state, "error");
  assert.equal(row.online.source, "ops");
});

test("stored Strapi amounts determine powder levels", () => {
  const machine = {
    id: 147,
    serial_number: "147",
    machine_type: { name: "Touch", container_count: 8 },
  } as unknown as Machine;
  const row = applyStoredPowderLevels(buildMachineHealthRow(machine, NOW), machine, [
    {
      id: 1,
      position: 1,
      isActive: true,
      cell_category: "powder",
      amount_kg: 2.75,
      product: { id: 1, name: "Chocolate" },
    },
  ]);

  assert.equal(row.powderLevels?.[0], 50);
  assert.deepEqual(row.powderLevels?.slice(1), Array(7).fill(null));
  assert.equal(row.powders.label, "1 loaded");
  assert.equal(row.powders.source, "ops");
});
