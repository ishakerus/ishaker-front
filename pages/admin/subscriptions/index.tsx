import type { GetServerSideProps } from "next";
import { requireAdminSession } from "../../../lib/admin/auth";
import { subscriptionClientHref } from "../../../lib/admin/subscriptions";
export { default } from "../../../components/admin/AdminSubscriptionsPage";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const auth = await requireAdminSession(context);
  if (auth) return auth;
  // Preserve links bookmarked before client pages had dedicated routes.
  if (typeof context.query.client === "string" && /^\d+$/.test(context.query.client)) {
    return { redirect: { destination: subscriptionClientHref(context.query.client), permanent: false } };
  }
  return { props: {} };
};
