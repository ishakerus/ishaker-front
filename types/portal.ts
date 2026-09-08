import type { Client, Currency, Machine } from "./strapi";

export type RegistrationDraft = {
  nickname?: string;
  existingAccount?: boolean;
  machineId?: string | number;
  serialNumber?: string;
  machineTitle?: string;
  machineTypeName?: string;
  clientId?: string | number;
  company?: string;
  country?: string;
  state?: string;
  city?: string;
  contactName?: string;
  email?: string;
  messengerType?: "whatsapp";
  messengerCountryIso?: string;
  messengerCountryCode?: string;
  messengerValue?: string;
  notes?: string;
  password?: string;
  passwordConfirmation?: string;
  authProvider?: "local" | "google";
  currencyId?: string | number;
  currencyCode?: string;
  currencySymbol?: string;
};

export type PortalUser = {
  id: number;
  blocked?: boolean;
  confirmed?: boolean;
  username?: string;
  email: string;
  client?: {
    id: string | number;
    portal_access_enabled?: boolean;
  } | null;
  role?: {
    id: string | number;
    name?: string;
    type?: string;
  } | null;
};

export type PortalSession = {
  support?: { username: string; userId: number; machineId: number; expiresAt: number };
  user: PortalUser;
  client: Client;
  machines: Machine[];
  access: "client" | "product";
};

export type PortalMachineSummary = Machine & {
  statusLabel: string;
};

export type PortalCatalogProduct = {
  id: number;
  name: string;
  isActive?: boolean;
  product_type?: "powder" | "concentrate" | null;
  product_line?: Pick<PortalProductLine, "id" | "name" | "cups"> | null;
  brand?: PortalBrand | null;
  cup?: PortalCup | null;
  custom_main?: PortalMedia | null;
  taste?: PortalTaste | null;
  custom_circle?: PortalCircle | null;
  dosage?: PortalProductDosage | null;
};

export type PortalMachineCell = {
  id: number;
  position: number;
  isActive: boolean;
  cell_category: "powder" | "concentrate" | null;
  product: PortalCatalogProduct | null;
  price?: number | string | null;
  amount_kg?: number | string | null;
};

export type PortalCurrency = Currency;

export type PromoCode = {
  id: string | number;
  title?: string;
  code: string;
  discount_type: "PERCENT" | "FIXED";
  amount: number;
  qty?: number;
  used_count?: number;
  start_at: string;
  end_at: string;
  status?: "draft" | "active" | "expired" | "cancelled";
  notes?: string;
  machine?: Machine | null;
  client?: Client | null;
};

export type PortalTaste = {
  id: string | number;
  name: string;
  color?: string;
  isWebsiteVisible?: boolean;
  submission_status?: "pending" | "approved" | "rejected";
  main?: PortalMedia | null;
  default_splash?: PortalSplash | null;
  default_circle?: PortalCircle | null;
  client?: Client | null;
};

export type PortalCircle = {
  id: string | number;
  name?: string;
  color?: string | null;
  images?: PortalMedia[];
};

export type PortalComponent = {
  id: string | number;
  name: string;
  unit?: "mg" | "g" | "mcg" | "kJ" | "kcal";
  default_value?: number | string | null;
};

export type PortalNutritionFact = {
  name: string;
  qty: number | string;
  unit?: string | null;
};

export type PortalProductDosage = {
  full_drink_volume?: number | string | null;
  full_drink_price?: number | string | null;
  small_drink_volume?: number | string | null;
  small_drink_price?: number | string | null;
  water?: number | string | null;
  product?: number | string | null;
  conversion_factor?: number | string | null;
};

export type PortalProductType = "powder" | "concentrate";
export type PortalProductPurpose = "milkshake" | "sport nutrition";

export type PortalProduct = {
  id: string | number;
  name: string;
  isActive?: boolean;
  author?: Pick<PortalUser, "id" | "username" | "email"> | null;
  product_line?: Pick<PortalProductLine, "id" | "name"> | null;
  brand?: PortalBrand | null;
  cup?: PortalCup | null;
  description?: string | null;
  product_type?: PortalProductType | null;
  product_purpose?: PortalProductPurpose | null;
  serving_qty?: number | string | null;
  serving_unit?: "g" | "ml" | null;
  components?: PortalComponent[];
  nutrition?: PortalNutritionFact[];
  dosage?: PortalProductDosage | null;
  taste?: PortalTaste | null;
  custom_main?: PortalMedia | null;
  custom_circle?: PortalCircle | null;
  custom_splash?: PortalSplash | null;
};

export type PortalMedia = {
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
};

export type PortalSplash = {
  id: string | number;
  name: string;
  color?: string | null;
  isEmpty?: boolean;
  images?: PortalMedia[];
  author?: Pick<PortalUser, "id" | "username" | "email"> | null;
};

export type PortalCup = {
  id: string | number;
  name: string;
  color?: string | null;
  image?: PortalMedia | null;
  default_splash?: PortalSplash | null;
};

export type PortalBrand = {
  id: string | number;
  name: string;
  logo?: PortalMedia | null;
};

export type PortalProductLine = {
  id: string | number;
  name: string;
  isActive?: boolean;
  isPopular?: boolean;
  author?: Pick<PortalUser, "id" | "username" | "email"> | null;
  client?: Pick<Client, "id" | "company"> | null;
  machines?: Machine[];
  base_product_line?: Pick<PortalProductLine, "id" | "name" | "cups"> | null;
  cups?: PortalCup[];
  brands?: PortalBrand[];
  custom_splash?: PortalSplash | null;
  products?: PortalProduct[];
};
