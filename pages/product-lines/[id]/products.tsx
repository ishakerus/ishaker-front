import type { GetServerSideProps } from "next";

export default function ProductLineProductsRoute() {
  return null;
}

// Product cards live on the main library page. Keep direct and bookmarked
// product-line URLs working and scroll to the requested line after it loads.
export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = typeof params?.id === "string" ? params.id : "";
  return {
    redirect: {
      destination: /^\d+$/.test(id) ? `/product-lines#product-line-${id}` : "/product-lines",
      permanent: false,
    },
  };
};
