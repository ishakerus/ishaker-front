import type { GetServerSideProps } from "next";
import { requireAdminSession } from "../../../lib/admin/auth";
export { default } from "../../../components/admin/AdminSubscriptionsPage";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const auth = await requireAdminSession(context);
  if (auth) return auth;
  return typeof context.params?.clientId === "string" && /^\d+$/.test(context.params.clientId) ? { props: {} } : { notFound: true };
};
