import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect } from "react";
import type { ProductLinesPageProps } from "../../components/portal/product-lines";
import {
  PortalPageFailure,
  PortalPageLoading,
  PortalPageContent,
} from "../../components/portal/PortalPageState";
import { usePortalPage } from "../../lib/portal/usePortalPage";

const ProductLinesPage = dynamic<ProductLinesPageProps>(
  () =>
    // Next's webpack resolver supports extensionless source imports. The
    // repository's Node16 type resolver expects an emitted .js extension.
    // @ts-expect-error -- this import is bundled by Next, not Node directly.
    import("../../components/portal/product-lines").then(
      (module) => module.ProductLinesPage,
    ),
  {
    ssr: false,
    loading: () => <PortalPageLoading label="Product lines" />,
  },
);

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

export default function ProductLinesRoute() {
  const router = useRouter();
  useEffect(() => {
    // Start the larger UI chunk while the authenticated bootstrap request runs.
    // @ts-expect-error -- Next resolves the extensionless TSX source import.
    void import("../../components/portal/product-lines");
  }, []);
  const params = new URLSearchParams();
  const machineId = first(router.query.machineId);
  const action = first(router.query.action);
  if (machineId) params.set("machineId", machineId);
  if (action) params.set("action", action);
  const query = params.toString();
  const { data, error, mutate } = usePortalPage<ProductLinesPageProps>(
    router.isReady
      ? `/api/portal/product-lines/bootstrap${query ? `?${query}` : ""}`
      : null,
    { refreshInterval: 120_000 },
  );

  if (error) {
    return (
      <PortalPageFailure
        label="Product lines"
        error={error}
        retry={() => void mutate()}
      />
    );
  }
  if (!data) return <PortalPageLoading label="Product lines" />;

  return (
    <PortalPageContent session={data.session}>
      <ProductLinesPage
        {...data}
        onMachineRenamed={(id, title) => {
          void mutate((current) => current ? {
            ...current,
            session: {
              ...current.session,
              machines: current.session.machines.map((machine) =>
                String(machine.id) === String(id) ? { ...machine, title } : machine,
              ),
            },
            machineAssignments: current.machineAssignments.map((assignment) =>
              String(assignment.machine.id) === String(id)
                ? { ...assignment, machine: { ...assignment.machine, title } }
                : assignment,
            ),
          } : current, { revalidate: false });
        }}
      />
    </PortalPageContent>
  );
}
