import type { GetServerSideProps } from "next";
import { resolveAdminSession } from "../../lib/admin/auth";

export const getServerSideProps: GetServerSideProps = async (context) => ({
  redirect: {
    destination: await resolveAdminSession(context.req.headers.cookie)
      ? "/admin/dashboard"
      : "/login",
    permanent: false,
  },
});

export default function LegacyAdminLoginRedirect() {
  return null;
}
