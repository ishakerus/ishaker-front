import { requestStrapiRestWithJwt } from "../../services/server/strapiClient";
import type { SupportIdentity } from "./context";

export const recordSupportAudit = (admin: SupportIdentity, data: {
  event: "login" | "cabinet_start" | "cabinet_end" | "write_attempt" | "write_result";
  target_user_id?: number;
  client_id?: number;
  machine_id?: number;
  path?: string;
  method?: string;
  status?: number;
}) => requestStrapiRestWithJwt("/api/support-audits/record", admin.jwt, {
  method: "POST", body: JSON.stringify({ ...data, session_id: admin.sid }),
});
