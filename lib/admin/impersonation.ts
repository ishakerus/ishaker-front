import type { SupportIdentity } from "./context";
import { readCookie, seal, sessionCookie, unseal } from "./cookies";

export const SUPPORT_COOKIE = "ishaker_support_cabinet";
export const SUPPORT_TTL_SECONDS = 30 * 60;
export type CabinetSession = {
  sid: string;
  supportUserId: number;
  targetUserId: number;
  clientId: number;
  machineId: number;
  expiresAt: number;
};
export const hasSupportCabinet = (header?: string) =>
  Boolean(header?.split(";").some((v) => v.trim().startsWith(`${SUPPORT_COOKIE}=`)));
export const readSupportCabinet = (header?: string) =>
  unseal<CabinetSession>(SUPPORT_COOKIE, readCookie(header, SUPPORT_COOKIE));
export const createSupportCabinetCookie = (admin: SupportIdentity, target: { targetUserId: number; clientId: number; machineId: number }) => {
  const expiresAt = Math.min(admin.expiresAt, Date.now() + SUPPORT_TTL_SECONDS * 1000);
  return sessionCookie(SUPPORT_COOKIE, seal(SUPPORT_COOKIE, {
    ...target, supportUserId: admin.id, sid: admin.sid, expiresAt,
  }), Math.floor((expiresAt - Date.now()) / 1000));
};
export const clearSupportCabinetCookie = () => sessionCookie(SUPPORT_COOKIE, "", 0);
export const cabinetMatchesAdmin = (cabinet: CabinetSession | null, admin: SupportIdentity | null) =>
  Boolean(cabinet && admin && cabinet.sid === admin.sid && cabinet.supportUserId === admin.id);
