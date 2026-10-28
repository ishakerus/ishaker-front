import normalize from "./normalizer";

const PRODUCTION_STRAPI_URL = "https://admin.ishaker.xyz";

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

// Local frontend development uses the live backend too. Environment overrides
// must never redirect requests to a stale local or development Strapi database.
export const getStrapiBaseUrl = () => PRODUCTION_STRAPI_URL;

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
