import type { GetServerSideProps } from "next";
import { AdminDashboard } from "../../components/admin";
import { requireAdminSession } from "../../lib/admin/auth";
import { requestStrapiAsService } from "../../services/server/strapiClient";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import normalize from "../../services/normalizer";
import { AdminClientsQuery, AdminMachinesQuery } from "../../services/queries";
import type { Client, Machine } from "../../types/strapi";
import type { PortalUser } from "../../types/portal";

type DashboardProps = {
  clients: Client[];
  machines: Machine[];
  cabinetClientIds: number[];
  loadError?: string;
  readinessReferenceTime: number;
};

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (context) => {
  const redirect = await requireAdminSession(context);
  if (redirect) return redirect;

  try {
    const [clientsRaw, machinesRaw, users] = await Promise.all([
      requestStrapiAsService<any>(AdminClientsQuery),
      requestStrapiAsService<any>(AdminMachinesQuery),
      requestStrapiRestAsService<PortalUser[]>(
        "/api/users?fields[0]=id&fields[1]=blocked&fields[2]=confirmed&populate[0]=client&populate[1]=role&pagination[pageSize]=2000",
      ),
    ]);
    const clientsResult = normalize(clientsRaw);
    const machinesResult = normalize(machinesRaw);
    const clients = ((clientsResult?.clients || []) as Client[]).filter(
      (client) => client.status === "client",
    );
    const machines = (machinesResult?.machines || []) as Machine[];
    const cabinetClientIds = Array.from(
      new Set(
        users
          // The service role may filter users by their linked client but does
          // not expose role relations in its response. The cabinet endpoint
          // performs the authoritative role check again with the support JWT.
          .filter(
            (user) =>
              Boolean(user.client?.id) &&
              !user.blocked &&
              user.confirmed !== false &&
              user.client?.portal_access_enabled !== false,
          )
          .map((user) => Number(user.client!.id)),
      ),
    );

    return {
      props: { clients, machines, cabinetClientIds, readinessReferenceTime: Date.now() },
    };
  } catch (error) {
    console.error("[admin/dashboard] clients load failed:", error);
    return {
      props: {
        clients: [],
        machines: [],
        cabinetClientIds: [],
        readinessReferenceTime: Date.now(),
        loadError: "Client data is unavailable. Check Strapi connection and service credentials.",
      },
    };
  }
};

export default function AdminDashboardPage({
  clients,
  machines,
  cabinetClientIds,
  loadError,
  readinessReferenceTime,
}: DashboardProps) {
  return (
    <AdminDashboard
      clients={clients}
      machines={machines}
      cabinetClientIds={cabinetClientIds}
      loadError={loadError}
      readinessReferenceTime={readinessReferenceTime}
    />
  );
}
