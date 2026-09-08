import { AsyncLocalStorage } from "async_hooks";
import type { PortalSession } from "../../types/portal";

export type SupportIdentity = {
  id: number;
  username: string;
  jwt: string;
  sid: string;
  expiresAt: number;
  updatedAt: string;
  portalSession?: PortalSession;
};

// Each request keeps its own credential, including concurrent support/client requests.
export const supportContext = new AsyncLocalStorage<SupportIdentity>();
