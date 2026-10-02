import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect } from "react";
import type { NewProductPageProps } from "../../../../components/portal/product-lines/new-product";
import {
  PortalPageFailure,
  PortalPageLoading,
  PortalPageContent,
} from "../../../../components/portal/PortalPageState";
import { usePortalPage } from "../../../../lib/portal/usePortalPage";

const NewProductPage = dynamic<NewProductPageProps>(
  () =>
    // @ts-expect-error -- Next resolves the extensionless TSX source import.
    import("../../../../components/portal/product-lines/new-product").then(
      (module) => module.NewProductPage,
    ),
  {
    ssr: false,
    loading: () => <PortalPageLoading label="Product editor" />,
  },
);

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

export default function ProductEditorRoute() {
  const router = useRouter();
  useEffect(() => {
    // @ts-expect-error -- Next resolves the extensionless TSX source import.
    void import("../../../../components/portal/product-lines/new-product");
  }, []);
  const productLineId = first(router.query.id);
  const productId = first(router.query.productId);
  const validRoute =
    /^\d+$/.test(productLineId) && (!productId || /^\d+$/.test(productId));
  const params = new URLSearchParams();
  if (productId) params.set("productId", productId);
  const query = params.toString();
  const key =
    router.isReady && validRoute
      ? `/api/portal/product-lines/${encodeURIComponent(productLineId)}/products/editor${query ? `?${query}` : ""}`
      : null;
  const { data, error, mutate } = usePortalPage<NewProductPageProps>(key);

  useEffect(() => {
    if (router.isReady && !validRoute) void router.replace("/product-lines");
  }, [router, validRoute]);
  if (error) {
    return (
      <PortalPageFailure
        label="Product editor"
        error={error}
        retry={() => void mutate()}
      />
    );
  }
  if (!data) return <PortalPageLoading label="Product editor" />;

  return (
    <PortalPageContent session={data.session}>
      <NewProductPage
        key={`${productLineId}:${data.editingProduct?.id || "new"}`}
        {...data}
      />
    </PortalPageContent>
  );
}
