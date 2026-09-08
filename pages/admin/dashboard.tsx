import type { GetServerSideProps } from "next";
import { AdminDashboard } from "../../components/admin";
import { requireAdminSession } from "../../lib/admin/auth";
import { requestStrapiAsService } from "../../services/server/strapiClient";
import normalize from "../../services/normalizer";
import { AdminClientsQuery, AdminMachinesQuery } from "../../services/queries";
import type { Client, Machine } from "../../types/strapi";

type DashboardProps = {
  clients: Client[];
  machines: Machine[];
  loadError?: string;
  readinessReferenceTime: number;
};

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (context) => {
  const redirect = await requireAdminSession(context);
  if (redirect) return redirect;

  try {
    const [clientsRaw, machinesRaw] = await Promise.all([
      requestStrapiAsService<any>(AdminClientsQuery),
      requestStrapiAsService<any>(AdminMachinesQuery),
    ]);
    const clientsResult = normalize(clientsRaw);
    const machinesResult = normalize(machinesRaw);
    const clients = ((clientsResult?.clients || []) as Client[]).filter(
      (client) => client.status === "client",
    );
    const machines = (machinesResult?.machines || []) as Machine[];

    return {
      props: { clients, machines, readinessReferenceTime: Date.now() },
    };
  } catch (error) {
    console.error("[admin/dashboard] clients load failed:", error);
    return {
      props: {
        clients: [],
        machines: [],
        readinessReferenceTime: Date.now(),
        loadError: "Client data is unavailable. Check Strapi connection and service credentials.",
      },
    };
  }
};

export default function AdminDashboardPage({
  clients,
  machines,
  loadError,
  readinessReferenceTime,
}: DashboardProps) {
  return (
    <AdminDashboard
      clients={clients}
      machines={machines}
      loadError={loadError}
      readinessReferenceTime={readinessReferenceTime}
    />
  );
}
