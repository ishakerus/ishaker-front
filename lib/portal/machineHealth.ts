import type { Machine } from "../../types/strapi";
import type { PortalMachineCell } from "../../types/portal";
import type {
  MachineHealthIndicator,
  MachineHealthRow,
  TelemetryHealthInput,
} from "../../types/machineHealth";
import { getMachineContainerCount } from "./containerSlots";

const STALE_AFTER_MS = 10 * 60 * 1000;
// A kiosk that has just been relaunched has not counted a frame yet. FleetPulse restarts it
// itself on every media push, so this window comes up routinely and must not read as a fault.
const STARTUP_GRACE_S = 120;

const unknown = (label = "No data"): MachineHealthIndicator => ({
  state: "unknown",
  label,
  source: "none",
  at: null,
});

const isStale = (at?: string | null, now = Date.now()) => {
  if (!at) return true;
  const timestamp = Date.parse(at);
  return Number.isNaN(timestamp) || now - timestamp > STALE_AFTER_MS;
};

const finiteNumber = (value: unknown): number | null => {
  const number = Number(value);
  return value === null || value === "" || !Number.isFinite(number)
    ? null
    : number;
};

const liters = (milliliters: number) => {
  const value = milliliters / 1000;
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} L`;
};

const waterLevelState = (litersRemaining: number): MachineHealthIndicator["state"] => {
  if (litersRemaining < 1) return "error";
  if (litersRemaining < 2) return "low";
  if (litersRemaining < 5) return "warning";
  return "ok";
};

const cupsLevelState = (cupsRemaining: number): MachineHealthIndicator["state"] => {
  if (cupsRemaining < 5) return "error";
  if (cupsRemaining < 10) return "low";
  if (cupsRemaining < 20) return "warning";
  return "ok";
};

const fillPercentage = (
  current: unknown,
  maximum: unknown,
  isEmpty = false,
) => {
  const currentValue = finiteNumber(current);
  const maximumValue = finiteNumber(maximum);
  if (currentValue !== null && currentValue <= 0) return 0;
  if (currentValue !== null && maximumValue !== null && maximumValue > 0) {
    return Math.max(0, Math.min(100, (currentValue / maximumValue) * 100));
  }
  return isEmpty ? 0 : 100;
};

const powderLevelsState = (
  levels: Array<number | null>,
): MachineHealthIndicator["state"] => {
  const assignedLevels = levels.filter(
    (level): level is number => level !== null && level > 0,
  );
  const lowest = assignedLevels.length ? Math.min(...assignedLevels) : null;
  if (lowest === null) return "unknown";
  if (lowest < 10) return "error";
  if (lowest < 20) return "low";
  if (lowest < 40) return "warning";
  return "ok";
};

export const applyStoredPowderLevels = (
  row: MachineHealthRow,
  machine: Machine,
  cells: PortalMachineCell[],
): MachineHealthRow => {
  const containerCount = getMachineContainerCount(machine.machine_type);
  if (containerCount === null) return row;
  if (
    cells.some(
      (cell) => cell.product && typeof cell.amount_kg === "undefined",
    )
  ) {
    return row;
  }

  const maximumKg = containerCount === 8 ? 2 : 1;
  const powderLevels = Array.from({ length: containerCount }, (_, index) => {
    const cell = cells.find((candidate) => candidate.position === index + 1);
    if (!cell?.product || cell.isActive === false) return null;
    const amountKg = finiteNumber(cell.amount_kg);
    if (amountKg === null || amountKg <= 0) return null;
    return Math.max(0, Math.min(100, (amountKg / maximumKg) * 100));
  });
  const assignedLevels = powderLevels.filter(
    (level): level is number => level !== null,
  );

  return {
    ...row,
    powderLevels,
    powders: {
      state: powderLevelsState(powderLevels),
      label: assignedLevels.length
        ? `${assignedLevels.length} loaded`
        : "No powder",
      source: "ops",
    },
  };
};

const ownHealth = (machine: Machine, now: number): MachineHealthRow | null => {
  const health = machine.health;
  if (!health) return null;

  const stale = isStale(health.at, now);
  // "App error" is a red badge in front of the client, so it has to mean the kiosk is
  // actually broken. It used to fire during the seconds a kiosk spends relaunching after a
  // media push — the machine was fine and the portal said otherwise (bone, 2026-08-18).
  // A kiosk inside its startup grace is Starting; only a process that stayed up past its
  // first heartbeat without moving frames, or one that is gone, is an error.
  const appState = health.app?.state ?? null;
  const uptimeSeconds =
    typeof health.app?.uptime_s === "number" ? health.app.uptime_s : null;
  const starting =
    health.app?.frames_ok !== true &&
    (appState === "starting" ||
      // Readings written before app.state existed: infer it from the uptime.
      (appState === null &&
        health.app?.frames_ok === false &&
        uptimeSeconds !== null &&
        uptimeSeconds <= STARTUP_GRACE_S));
  const online: MachineHealthIndicator = stale
    ? { state: "unknown", label: "Stale", source: "own", at: health.at }
    : starting
      ? { state: "warning", label: "Starting", source: "own", at: health.at }
      : health.app?.frames_ok === true
        ? { state: "ok", label: "Online", source: "own", at: health.at }
        : health.app?.frames_ok === false
          ? {
              state: "error",
              label: appState === "down" ? "App down" : "App error",
              source: "own",
              at: health.at,
            }
          : { state: "unknown", label: "No data", source: "own", at: health.at };

  const terminalAt = health.terminal?.at || health.at;
  const terminalStale = isStale(terminalAt, now);
  const terminal: MachineHealthIndicator = terminalStale
    ? { state: "unknown", label: "Stale", source: "own", at: terminalAt }
    : health.terminal?.card === true
      ? {
          state: "ok",
          label: "Available",
          source: "own",
          at: terminalAt,
        }
      : health.terminal?.card === false
        ? {
            state: "error",
            label: "Unavailable",
            source: "own",
            at: terminalAt,
          }
        : { state: "unknown", label: "No data", source: "own", at: health.at };

  const waterCurrent = finiteNumber(health.water?.current);
  const waterMax = finiteNumber(health.water?.max);
  const waterLabel =
    waterCurrent !== null
      ? waterMax !== null
        ? `${liters(waterCurrent)} / ${liters(waterMax)}`
        : liters(waterCurrent)
      : "No data";
  const water: MachineHealthIndicator = stale
    ? { state: "unknown", label: "Stale", source: "own", at: health.at }
    : {
        state:
          waterCurrent === null
            ? "unknown"
            : waterLevelState(waterCurrent / 1000),
        label: waterLabel,
        source: "own",
        at: health.at,
      };

  const containers = health.containers || [];
  const configuredContainerCount = getMachineContainerCount(machine.machine_type);
  const containerCount =
    configuredContainerCount ||
    Math.max(0, ...containers.map((container) => Number(container.position) || 0));
  const powderLevels = Array.from({ length: containerCount }, (_, index) => {
    const container = containers.find(
      (candidate) => Number(candidate.position) === index + 1,
    );
    if (!container) return null;
    const current = finiteNumber(container.current);
    const servingsLeft = finiteNumber(container.servings_left);
    const hasPowder =
      (current !== null && current > 0) ||
      (servingsLeft !== null && servingsLeft > 0);
    const isAssigned = Boolean(container.product) || hasPowder || container.runs_out;
    if (!isAssigned || current === 0 || (!hasPowder && servingsLeft === 0)) {
      return null;
    }
    const level = fillPercentage(
      container.current ?? (container.runs_out ? 1 : null),
      container.max,
      false,
    );
    return container.runs_out && level >= 10 ? 9 : level > 0 ? level : null;
  });
  const lowContainers = containers.filter((container) => container.runs_out);
  const powders: MachineHealthIndicator = stale
    ? { state: "unknown", label: "Stale", source: "own", at: health.at }
    : !containers.length
      ? { state: "unknown", label: "No data", source: "own", at: health.at }
      : {
          state: powderLevelsState(powderLevels),
          label: lowContainers.length
            ? `${lowContainers.length} low`
            : `${containers.length} OK`,
          source: "own",
          at: health.at,
        };

  const cupErrorCodes = new Set([20, 126, 135, 600, 601, 602]);
  const hasCupError = (health.errors || []).some(
    (error) => error.code != null && cupErrorCodes.has(error.code),
  );
  const cupCount = finiteNumber(health.cups?.current);
  const cups =
    health.cups?.tracked === false
      ? null
      : stale
        ? {
            state: "unknown" as const,
            label: "Stale",
            source: "own" as const,
            at: health.at,
          }
        : health.cups
          ? {
              state: hasCupError
                ? ("error" as const)
                : cupsLevelState(cupCount || 0),
              label:
                cupCount === null
                  ? "No data"
                  : hasCupError
                    ? `${cupCount} · error`
                    : `${cupCount} left`,
              source: "own" as const,
              at: health.at,
            }
          : unknown();

  return {
    id: machine.id,
    serial_number: machine.serial_number,
    online,
    terminal,
    water,
    powders,
    powderLevels,
    cups,
  };
};

const telemetryIndicators = (
  telemetry?: TelemetryHealthInput | null,
  configuredContainerCount?: number | null,
) => {
  const connectionStatus = String(
    telemetry?.status?.connectionStatus || "",
  ).toUpperCase();
  const online: MachineHealthIndicator =
    connectionStatus === "ONLINE"
      ? { state: "ok", label: "Online", source: "telemetry" }
      : connectionStatus === "OFFLINE"
        ? { state: "error", label: "Offline", source: "telemetry" }
        : unknown();

  const storage = telemetry?.storage || {};
  const waters = Array.isArray(storage.cellWaters) ? storage.cellWaters : [];
  const waterCurrent = waters.reduce(
    (sum: number, cell: any) => sum + (finiteNumber(cell?.volume) || 0),
    0,
  );
  const waterMax = waters.reduce(
    (sum: number, cell: any) => sum + (finiteNumber(cell?.maxVolume) || 0),
    0,
  );
  const water: MachineHealthIndicator = waters.length
    ? {
        state: waterLevelState(waterCurrent / 1000),
        label: waterMax
          ? `${liters(waterCurrent)} / ${liters(waterMax)}`
          : liters(waterCurrent),
        source: "telemetry",
      }
    : unknown();

  const cells = Array.isArray(storage.cells) ? storage.cells : [];
  const containerCount = configuredContainerCount || cells.length;
  const powderLevels = Array.from({ length: containerCount }, (_, index) => {
    const cell = cells.find(
      (candidate: any, candidateIndex: number) =>
        Number(candidate?.position ?? candidate?.cellNumber ?? candidateIndex + 1) ===
        index + 1,
    );
    if (!cell || cell?.isActive === false) return null;
    const volume = finiteNumber(cell?.volume);
    const isAssigned =
      cell?.productId != null || Boolean(cell?.productName) || (volume !== null && volume > 0);
    if (!isAssigned || volume === null || volume <= 0) return null;
    const level = fillPercentage(cell?.volume, cell?.maxVolume);
    return level > 0 ? level : null;
  });
  const lowCells = powderLevels.filter(
    (level): level is number => level !== null && level < 40,
  );
  const powders: MachineHealthIndicator = cells.length
    ? {
        state: powderLevelsState(powderLevels),
        label: lowCells.length ? `${lowCells.length} low` : `${cells.length} OK`,
        source: "telemetry",
      }
    : unknown();

  const cupCells = Array.isArray(storage.cellCups) ? storage.cellCups : [];
  const cupCount = cupCells.reduce(
    (sum: number, cell: any) => sum + (finiteNumber(cell?.volume) || 0),
    0,
  );
  const cups: MachineHealthIndicator = cupCells.length
    ? {
      state: cupsLevelState(cupCount),
        label: `${cupCount} left`,
        source: "telemetry",
      }
    : unknown();

  return { online, water, powders, powderLevels, cups };
};

export const buildMachineHealthRow = (
  machine: Machine,
  telemetry?: TelemetryHealthInput | null,
  now = Date.now(),
): MachineHealthRow => {
  const waterType = machine.water_type || null;
  const waterAmountLiters = finiteNumber(machine.water_amount_liters);
  const cupsAmount = finiteNumber(machine.cups_amount);
  const persisted = { waterType, waterAmountLiters, cupsAmount };
  const own = ownHealth(machine, now);
  const fallback = telemetryIndicators(
    telemetry,
    getMachineContainerCount(machine.machine_type),
  );
  const fleet = machine.fleet_status as Record<string, unknown> | null | undefined;
  const fleetAt = typeof fleet?.at === "string" ? fleet.at : null;
  const fleetFresh = Boolean(fleetAt && !isStale(fleetAt, now));
  const fleetHealthy = fleet?.sweep === "ok" && fleet?.ssh_ok === true;
  // An SSH sweep only tells us whether FleetPulse can open a remote shell. A failed
  // sweep must not call the whole machine Offline when the cabinet is actively connected
  // to telemetry. Conversely, a successful SSH sweep is strong positive evidence even if
  // the third-party status has not caught up yet.
  const currentOnline: MachineHealthIndicator = fleetFresh && fleetHealthy
    ? { state: "ok", label: "Online", source: "ops", at: fleetAt }
    : fallback.online.state === "ok"
      ? fallback.online
      : fleetAt
        ? fleetFresh
          ? { state: "error", label: "Offline", source: "ops", at: fleetAt }
          : fallback.online.state !== "unknown"
            ? fallback.online
            : { state: "unknown", label: "Stale", source: "ops", at: fleetAt }
        : fallback.online;
  const online: MachineHealthIndicator = {
    ...currentOnline,
    // `at` is the time of the latest status report. When that report says Offline,
    // only last_seen_at tells us when the machine was actually online most recently.
    lastOnlineAt:
      currentOnline.state === "ok" && currentOnline.at
        ? currentOnline.at
        : machine.last_seen_at || null,
  };

  if (own) {
    // Levels stay on the own reading even once it ages — "this is what we last saw" is
    // still the most accurate thing anyone has, and the row labels it Stale. The online
    // badge is the exception: a stale reading must not go on claiming the machine is up,
    // so it is handed back to whichever source is still reporting. A fresh own reading
    // normally wins because it comes from inside the machine; the exception is the brief
    // Starting state, which should not override a concurrent positive connection report.
    const ownFresh = !isStale(machine.health?.at, now);
    const ownOnline = ownFresh
      ? own.online.state === "warning" && online.state === "ok"
        ? online
        : {
            ...own.online,
            lastOnlineAt:
              own.online.state === "ok" && own.online.at
                ? own.online.at
                : machine.last_seen_at || null,
          }
      : online;
    const water = waterType === "mains"
      ? { state: "ok" as const, label: "∞ Mains", source: "ops" as const }
      : waterType === "bottle" && waterAmountLiters !== null
        ? {
            state: waterLevelState(waterAmountLiters),
            label: `${waterAmountLiters.toFixed(1)} L`,
            source: "ops" as const,
          }
        : own.water;
    const cups = cupsAmount !== null
      ? {
          state: cupsLevelState(cupsAmount),
          label: `${cupsAmount} left`,
          source: "ops" as const,
        }
      : own.cups;
    return { ...own, online: ownOnline, water, cups, ...persisted };
  }

  return {
    id: machine.id,
    serial_number: machine.serial_number,
    online,
    terminal: unknown(),
    water:
      waterType === "mains"
        ? { state: "ok", label: "∞ Mains", source: "ops" }
        : waterType === "bottle" && waterAmountLiters !== null
          ? {
              state: waterLevelState(waterAmountLiters),
              label: `${waterAmountLiters.toFixed(1)} L`,
              source: "ops",
            }
          : fallback.water,
    powders: fallback.powders,
    powderLevels: fallback.powderLevels,
    cups:
      cupsAmount !== null
        ? {
            state: cupsLevelState(cupsAmount),
            label: `${cupsAmount} left`,
            source: "ops",
          }
        : fallback.cups,
    ...persisted,
  };
};
