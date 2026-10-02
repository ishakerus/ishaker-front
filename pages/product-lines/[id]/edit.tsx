import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect } from "react";
import type { NewProductLinePageProps } from "../../../components/portal/product-lines/NewProductLinePage";
import {
  PortalPageFailure,
  PortalPageLoading,
  PortalPageContent,
} from "../../../components/portal/PortalPageState";
import { usePortalPage } from "../../../lib/portal/usePortalPage";

const NewProductLinePage = dynamic<NewProductLinePageProps>(
  () =>
    // @ts-expect-error -- Next resolves the extensionless TSX source import.
    import("../../../components/portal/product-lines/NewProductLinePage").then(
      (module) => module.NewProductLinePage,
    ),
  {
    ssr: false,
    loading: () => <PortalPageLoading label="Edit product line" />,
  },
);

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

export default function EditProductLineRoute() {
  const router = useRouter();
  useEffect(() => {
    // @ts-expect-error -- Next resolves the extensionless TSX source import.
    void import("../../../components/portal/product-lines/NewProductLinePage");
  }, []);
  const productLineId = first(router.query.id);
  const validRoute = /^\d+$/.test(productLineId);
  const key =
    router.isReady && validRoute
      ? `/api/portal/product-lines/${encodeURIComponent(productLineId)}/editor`
      : null;
  const { data, error, mutate } = usePortalPage<NewProductLinePageProps>(key);

  useEffect(() => {
    if (router.isReady && !validRoute) void router.replace("/product-lines");
  }, [router, validRoute]);
  if (error) {
    return (
      <PortalPageFailure
        label="Edit product line"
        error={error}
        retry={() => void mutate()}
      />
    );
  }
  if (!data) return <PortalPageLoading label="Edit product line" />;

  return (
    <PortalPageContent session={data.session}>
      <NewProductLinePage key={productLineId} {...data} />
    </PortalPageContent>
  );
}
