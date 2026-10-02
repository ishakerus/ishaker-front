import type {
  PortalMachineCell,
  PortalSession,
  PromoCode,
} from "../../types/portal";
import type { Currency, Language } from "../../types/strapi";
import { getMachineCells } from "./machineCells";
import { requestStrapiRestAsService } from "./strapiClient";

const REFERENCE_CACHE_MS = 15 * 60 * 1000;

type ReferenceCacheEntry = {
  expiresAt: number;
  value: Promise<unknown>;
};

const referenceCache = new Map<string, ReferenceCacheEntry>();

const cachedReference = <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const cached = referenceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as Promise<T>;
  }

  const value = load().catch((error) => {
    referenceCache.delete(key);
    throw error;
  });
  referenceCache.set(key, {
    expiresAt: Date.now() + REFERENCE_CACHE_MS,
    value,
  });
  return value;
};

const loadActiveCurrencies = () =>
  cachedReference("portal:currencies:active", () =>
    requestStrapiRestAsService<Currency[]>(
      "/api/currencies?filters[isActive][$eq]=true&sort[0]=code:ASC&pagination[pageSize]=2000",
    ),
  );

const loadActiveLanguages = () =>
  cachedReference("portal:languages:active", () =>
    requestStrapiRestAsService<Language[]>(
      "/api/languages?filters[isActive][$eq]=true&sort[0]=name:ASC&pagination[pageSize]=2000",
    ),
  );

export class PortalMachineNotFoundError extends Error {
  constructor() {
    super("Machine not found.");
    this.name = "PortalMachineNotFoundError";
  }
}

export const loadMachinesPage = (session: PortalSession) => ({ session });

export const loadMachineDetailPage = async (
  session: PortalSession,
  machineId: string,
) => {
  const machine = session.machines.find(
    (item) => String(item.id) === String(machineId),
  );
  if (!machine) throw new PortalMachineNotFoundError();

  const [references, storedCells] = await Promise.allSettled([
    Promise.all([loadActiveCurrencies(), loadActiveLanguages()]),
    getMachineCells(machine.id),
  ]);

  let currencies: Currency[] = [];
  let languages: Language[] = [];
  let cells: PortalMachineCell[] | null = null;

  if (references.status === "fulfilled") {
    [currencies, languages] = references.value;
  } else {
    console.error(
      "[machines/detail] reference loading failed:",
      references.reason,
    );
  }

  if (storedCells.status === "fulfilled") {
    cells = storedCells.value;
  } else {
    console.error(
      "[machines/detail] container loading failed:",
      storedCells.reason,
    );
  }

  return { session, machine, cells, currencies, languages };
};

export const loadPromosPage = async (session: PortalSession) => {
  const serverNow = Date.now();
  try {
    const params = new URLSearchParams();
    params.set("filters[client][id][$eq]", String(session.client.id));
    params.set("sort[0]", "start_at:desc");
    params.set("pagination[pageSize]", "2000");
    params.set("populate[machine][populate][currency]", "*");
    const promos = await requestStrapiRestAsService<PromoCode[]>(
      `/api/promo-codes?${params.toString()}`,
    );

    return { session, promos, serverNow };
  } catch (error) {
    console.error("[promos] load failed:", error);
    return {
      session,
      promos: [],
      serverNow,
      loadError:
        "Add the promo-code content type in Strapi to persist and list client promo codes.",
    };
  }
};
