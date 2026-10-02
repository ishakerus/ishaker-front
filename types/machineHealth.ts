export type HealthSource = "own" | "ops" | "none";

export type HealthState = "ok" | "warning" | "low" | "error" | "unknown";

export type MachineHealthIndicator = {
  state: HealthState;
  label: string;
  source: HealthSource;
  at?: string | null;
  lastOnlineAt?: string | null;
};

export type MachineHealthRow = {
  id: string | number;
  serial_number: string;
  online: MachineHealthIndicator;
  terminal: MachineHealthIndicator;
  water: MachineHealthIndicator;
  powders: MachineHealthIndicator;
  powderLevels?: Array<number | null>;
  cups: MachineHealthIndicator | null;
  waterType?: "bottle" | "mains" | null;
  waterAmountLiters?: number | null;
  cupsAmount?: number | null;
};
