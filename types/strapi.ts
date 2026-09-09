export type MachineReadinessVerdict = "SHIP" | "REVIEW" | "DO_NOT_SHIP";

export type MachineReadiness = {
  at?: string | null;
  verdict: MachineReadinessVerdict;
  counts?: {
    ok?: number;
    warn?: number;
    fail?: number;
  } | null;
  failed?: string[] | null;
  warned?: string[] | null;
  detail?: Record<string, string> | null;
};

export type Patch = {
  id: string | number;
  slug?: string | null;
  fix_summary?: string | null;
  isStable?: boolean;
  root_cause?: string | null;
  deployed_at?: string | null;
};

export type Language = {
  id: string | number;
  code: string;
  name: string;
  native_name?: string | null;
  app_name?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  sort_order?: number | null;
};

export type TranslationSet = {
  id: string | number;
  name: string;
  slug?: string | null;
  language?: Language | null;
  client?: Pick<Client, "id" | "company"> | null;
  is_root?: boolean;
  based_on?: TranslationSet | null;
  isActive?: boolean;
  notes?: string | null;
};

export type Machine = {
  id: string | number;
  has_door_lock?: boolean | null;
  free_mode?: boolean | null;
  free_mode_minutes?: number | string | null;
  free_mode_started_at?: string | null;
  free_mode_rev?: number | string | null;
  free_mode_source?: "portal" | "machine" | null;
  type?: "small" | "big";
  status?: "new" | "ready" | "shipped" | "working" | "error" | "offline";
  title?: string;
  nickname?: string | null;
  hostname?: string;
  description?: string;
  context?: string;
  anydesk_id?: string;
  rustdesk_id?: string | null;
  rustdesk_password?: string | null;
  tailscale_ip?: string;
  tailscale_hostname?: string;
  ssh_user?: string;
  ssh_port?: number;
  serial_number: string;
  unity_version?: string;
  ssd_version?: string;
  bootstrap_version?: string;
  last_seen_at?: string;
  health?: {
    at?: string | null;
    app?: {
      uptime_s?: number | null;
      frames_ok?: boolean | null;
      // Written by fleetpulse build_health(): "ok" | "starting" | "stalled" | "down".
      // "starting" is a kiosk inside its first heartbeat — no frames counted yet, which
      // is not the same thing as broken. Absent on readings taken before 2026-08-18.
      state?: "ok" | "starting" | "stalled" | "down" | null;
    } | null;
    terminal?: {
      card?: boolean | null;
      at?: string | null;
    } | null;
    water?: {
      current?: number | null;
      max?: number | null;
      low?: boolean | null;
      counter_reset_at?: string | null;
    } | null;
    cups?: {
      current?: number | null;
      low?: boolean | null;
      tracked?: boolean | null;
      counter_reset_at?: string | null;
    } | null;
    containers?: Array<{
      position?: number | null;
      current?: number | null;
      max?: number | null;
      servings_left?: number | null;
      runs_out?: boolean | null;
      product?: string | null;
      counter_reset_at?: string | null;
    }> | null;
    errors?: Array<{
      code?: number | null;
      at?: string | null;
    }> | null;
  } | null;
  fleet_status?: {
    patch_id?: string | number | null;
    device_serial?: string | null;
    identity_at?: string | null;
    scanner_ok?: boolean | null;
    scanner_dev?: string | null;
    media_keys?: {
      checked?: number;
      missing?: string[];
    } | null;
    [key: string]: unknown;
  } | null;
  patch?: Patch | null;
  readiness?: MachineReadiness | null;
  country?: string;
  state_region?: string;
  city?: string;
  admin_comment?: string;
  product_lines?: Array<{
    id: string | number;
    name?: string;
    isActive?: boolean;
  }>;
  client?: Client | null;
  machine_type?: {
    id: string | number;
    name?: string;
    container_count?: number | null;
    preview?: {
      id: string | number;
      name?: string;
      url?: string;
      formats?: Record<
        string,
        {
          url?: string;
          width?: number;
          height?: number;
        }
      > | null;
    } | null;
  } | null;
  currency?: Currency | null;
  nayax_terminal_id?: string | null;
  water_type?: "bottle" | "mains" | null;
  water_amount_liters?: number | string | null;
  cups_amount?: number | null;
  language?: Language | null;
  translation_set?: TranslationSet | null;
};

export type Currency = {
  id: string | number;
  code: string;
  name?: string | null;
  symbol?: string | null;
  symbol_position?: "before" | "after";
  decimal_digits?: number;
  rounding?: number | string | null;
  thousands_separator?: string | null;
  decimal_separator?: string | null;
  isActive?: boolean;
};

export type ClientContact =
  | {
      __typename?: "ComponentTelegramTelegram";
      telegram?: string;
    }
  | {
      __typename?: "ComponentWhatsappWhatsapp";
      whatsapp?: string;
    }
  | {
      __typename?: string;
      [key: string]: unknown;
    };

export type Client = {
  id: string | number;
  company: string;
  portal_email?: string | null;
  portal_access_enabled?: boolean;
  portal_auth_provider?: "local" | "google" | "apple" | "facebook";
  telemetry_organization_id?: number | null;
  country?: string;
  state?: string;
  city?: string;
  status?: "admin" | "client" | "blocked";
  contact?: ClientContact[];
  machines?: Machine[];
  currency?: Currency | null;
  nayax_actor_id?: string | null;
  nayax_status?: "unconfigured" | "ok" | "error";
  nayax_error?: string | null;
  nayax_last_sync_at?: string | null;
};

export type Sale = {
  id: string | number;
  sale_uuid?: string | null;
  source?: "kiosk" | "csv_harvest" | "nayax" | "manual";
  outcome?: "dispensed" | "failed" | "refunded" | "unknown";
  nayax_transaction_id?: string | null;
  nayax_terminal_id?: string | null;
  machine?: Machine | null;
  client?: Client | null;
  serial_number?: string | null;
  occurred_at_local?: string | null;
  machine_tz?: string | null;
  reported_at?: string | null;
  machine_cell?: { id: string | number; position?: number | null } | null;
  cell_position?: number | null;
  product?: { id: string | number; name?: string | null } | null;
  product_line?: { id: string | number; name?: string | null } | null;
  taste?: { id: string | number; name?: string | null } | null;
  cup?: { id: string | number; name?: string | null } | null;
  product_2?: { id: string | number; name?: string | null } | null;
  taste_2?: { id: string | number; name?: string | null } | null;
  is_mix?: boolean;
  amount?: number | string | null;
  list_price?: number | string | null;
  discount_amount?: number | string | null;
  promo_code?: string | null;
  is_free?: boolean;
  currency?: Currency | null;
  currency_code?: string | null;
  payment_method?: string | null;
  card_brand?: string | null;
  product_name?: string | null;
  cup_size?: "full" | "medium" | string | null;
  drink_volume_ml?: number | null;
  powder_g?: number | string | null;
  water_ml?: number | string | null;
  cups_used?: number | null;
  addon_product?: { id: string | number; name?: string | null } | null;
  addon_g?: number | string | null;
  writeoffs?: Array<{
    position?: number | null;
    product_id?: string | number | null;
    grams?: number | string | null;
    unit?: string | null;
  }> | null;
  remains_after?: {
    containers?: Record<string, number | string | null>;
    water_ml?: number | string | null;
    cups?: number | string | null;
  } | null;
  patch_slug?: string | null;
  raw?: { clock_suspect?: unknown; [key: string]: unknown } | null;
  status?: "authorized" | "settled" | "refunded" | "declined" | "unknown";
  occurred_at?: string | null;
};

export type SalesSummaryTotals = {
  cups: number;
  revenue: number;
  free_cups: number;
  powder_g: number;
  water_ml: number;
  cups_used: number;
  avg_check?: number;
};

export type SalesSummaryGroup = Omit<SalesSummaryTotals, "avg_check"> & {
  key: string;
};

export type SalesSummary = {
  range: { from: string | null; to: string | null };
  group: "day" | "product" | "machine" | "cell";
  currency: string | null;
  truncated: boolean;
  totals: SalesSummaryTotals;
  groups: SalesSummaryGroup[];
};

export type MachineLookupResponse = {
  machine: Machine | null;
  client: Client | null;
};
