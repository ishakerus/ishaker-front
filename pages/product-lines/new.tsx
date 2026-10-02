import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect } from "react";
import type { NewProductLinePageProps } from "../../components/portal/product-lines/NewProductLinePage";
import {
  PortalPageFailure,
  PortalPageLoading,
  PortalPageContent,
} from "../../components/portal/PortalPageState";
import { usePortalPage } from "../../lib/portal/usePortalPage";

const NewProductLinePage = dynamic<NewProductLinePageProps>(
  () =>
    // @ts-expect-error -- Next resolves the extensionless TSX source import.
    import("../../components/portal/product-lines/NewProductLinePage").then(
      (module) => module.NewProductLinePage,
    ),
  {
    ssr: false,
    loading: () => <PortalPageLoading label="New product line" />,
  },
);

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

export default function NewProductLineRoute() {
  const router = useRouter();
  useEffect(() => {
    // @ts-expect-error -- Next resolves the extensionless TSX source import.
    void import("../../components/portal/product-lines/NewProductLinePage");
  }, []);
  const baseProductLineId = first(router.query.baseProductLineId);
  const params = new URLSearchParams();
  if (baseProductLineId) {
    params.set("baseProductLineId", baseProductLineId);
  }
  const query = params.toString();
  const { data, error, mutate } = usePortalPage<NewProductLinePageProps>(
    router.isReady
      ? `/api/portal/product-lines/editor${query ? `?${query}` : ""}`
      : null,
  );

  if (error) {
    return (
      <PortalPageFailure
        label="New product line"
        error={error}
        retry={() => void mutate()}
      />
    );
  }
  if (!data) return <PortalPageLoading label="New product line" />;

  return (
    <PortalPageContent session={data.session}>
      <NewProductLinePage
        key={`new:${data.initialBaseProductLineId || "none"}`}
        {...data}
      />
    </PortalPageContent>
  );
}
