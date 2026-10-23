import normalize from "./normalizer";

const DEFAULT_STRAPI_URL = "https://admin.ishaker.xyz";

const unwrap = (data: any) => {
  if (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    Object.keys(data).length === 1
  ) {
    return data[Object.keys(data)[0]];
  }
  return data;
};

export const getStrapiBaseUrl = () =>
  (
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    DEFAULT_STRAPI_URL
  ).replace(/\/$/, "");

export const initCMSFetcher = () => {
  const url = `${getStrapiBaseUrl()}/graphql`;

  return async (query: string, variables?: Record<string, any>) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      const payload = await response.json();

      if (!response.ok || payload.errors?.length) {
        return null;
      }

      return unwrap(normalize(payload.data));
    } catch (error) {
      console.error("CMS FETCHER ERROR:", error);
      return null;
    }
  };
};

export const fetchStrapiRest = async (path: string) => {
  const response = await fetch(`${getStrapiBaseUrl()}${path}`);
  const payload = await response.json();

  if (!response.ok || payload.error) {
    return null;
  }

  return normalize(payload);
};
