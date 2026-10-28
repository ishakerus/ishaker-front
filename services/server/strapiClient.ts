import { fetchJsonWithTimeout } from "../../lib/http/fetchJsonWithTimeout";
import { supportContext } from "../../lib/admin/context";
import { canSupportWriteStrapi } from "../../lib/admin/permissions";
import { getStrapiBaseUrl } from "../fetchers";
import normalize from "../normalizer";

const AUTH_PROVIDER = "local";
const TOKEN_REFRESH_SKEW_MS = 60_000;

type CachedToken = {
  jwt: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | null = null;
let loginPromise: Promise<string> | null = null;

const getServiceCredentialCandidates = () => {
  const candidates = [
    {
      identifier: process.env.STRAPI_MACHINE_USER_LOGIN,
      password: process.env.STRAPI_MACHINE_USER_PASSWORD,
    },
    {
      identifier: process.env.STRAPI_AUTH_IDENTIFIER,
      password: process.env.STRAPI_AUTH_PASSWORD,
    },
  ].filter(
    (
      candidate,
    ): candidate is {
      identifier: string;
      password: string;
    } => Boolean(candidate.identifier && candidate.password),
  );
  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (item) =>
          item.identifier === candidate.identifier &&
          item.password === candidate.password,
      ) === index,
  );

  if (!uniqueCandidates.length) {
    throw new Error(
      "Missing STRAPI_AUTH_IDENTIFIER/STRAPI_AUTH_PASSWORD or STRAPI_MACHINE_USER_LOGIN/STRAPI_MACHINE_USER_PASSWORD.",
    );
  }

  return uniqueCandidates;
};

const decodeJwtExpMs = (jwt: string) => {
  try {
    const payloadRaw = jwt.split(".")[1];
    if (!payloadRaw) return Date.now() + 30 * 60 * 1000;

    const base64 = payloadRaw.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp || !Number.isFinite(payload.exp)) {
      return Date.now() + 30 * 60 * 1000;
    }
    return payload.exp * 1000;
  } catch {
    return Date.now() + 30 * 60 * 1000;
  }
};

const requestGraphql = async <T = any>(
  query: string,
  variables?: Record<string, any>,
  jwt?: string,
) => {
  const { response, payload } = await fetchJsonWithTimeout(`${getStrapiBaseUrl()}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (payload?.data && typeof payload.data === "object") {
    return payload.data as T;
  }

  if (!response.ok || !payload || payload.errors?.length) {
    const error = new Error("Strapi GraphQL request failed") as Error & {
      response?: typeof payload;
      status?: number;
    };
    error.response = payload;
    error.status = response.status;
    throw error;
  }

  return payload.data as T;
};

const loginToStrapi = async () => {
  const candidates = getServiceCredentialCandidates();
  let lastStatus = 0;

  for (const { identifier, password } of candidates) {
    const { response, payload } = await fetchJsonWithTimeout(`${getStrapiBaseUrl()}/api/auth/local`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identifier,
        password,
        provider: AUTH_PROVIDER,
      }),
    });
    const jwt = payload?.jwt;
    lastStatus = response.status;

    if (!response.ok || !jwt) continue;

    cachedToken = {
      jwt,
      expiresAtMs: decodeJwtExpMs(jwt),
    };

    return jwt;
  }

  throw new Error(
    `Strapi service login failed${lastStatus ? ` (${lastStatus})` : ""}.`,
  );
};

const getStrapiJwt = async (forceRefresh = false) => {
  const now = Date.now();
  const tokenValid = Boolean(
    !forceRefresh &&
      cachedToken?.jwt &&
      cachedToken.expiresAtMs - TOKEN_REFRESH_SKEW_MS > now,
  );

  if (tokenValid) return cachedToken!.jwt;
  if (!loginPromise) {
    loginPromise = loginToStrapi().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
};

export const requestStrapiAsService = async <T = any>(
  query: string,
  variables?: Record<string, any>,
) => {
  const support = supportContext.getStore();
  if (support) return requestGraphql<T>(query, variables, support.jwt);
  let jwt = await getStrapiJwt(false);

  try {
    return await requestGraphql<T>(query, variables, jwt);
  } catch (error) {
    if ((error as { status?: number }).status !== 401) throw error;
    jwt = await getStrapiJwt(true);
    return requestGraphql<T>(query, variables, jwt);
  }
};

const requestStrapiRest = async <T = any>(
  path: string,
  init?: RequestInit,
  jwt?: string,
  shouldNormalize = true,
) => {
  const isMultipart =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const isRead = ["GET", "HEAD"].includes((init?.method || "GET").toUpperCase());

  const { response, payload } = await fetchJsonWithTimeout(`${getStrapiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(!isMultipart ? { "content-type": "application/json" } : {}),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(init?.headers || {}),
    },
  }, isRead ? 15_000 : 120_000);

  if (!response.ok || payload?.error) {
    const error = new Error("Strapi REST request failed") as Error & {
      response?: any;
      status?: number;
    };
    error.response = payload;
    error.status = response.status;
    throw error;
  }

  return (shouldNormalize ? normalize(payload) : payload) as T;
};

export const requestStrapiRestAsService = async <T = any>(
  path: string,
  init?: RequestInit,
) => {
  const support = supportContext.getStore();
  const method = (init?.method || "GET").toUpperCase();
  if (support) {
    if (!["GET", "HEAD"].includes(method) && !canSupportWriteStrapi(path, method)) {
      throw Object.assign(new Error("This action is outside support permissions."), { status: 403 });
    }
    // Use the signed-in operator's permissions for reads and writes. Never
    // substitute device/service credentials or retry with a different identity.
    return requestStrapiRest<T>(path, init, support.jwt, true);
  }
  let jwt = await getStrapiJwt(false);

  try {
    return await requestStrapiRest<T>(path, init, jwt);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 401) throw error;

    jwt = await getStrapiJwt(true);
    return requestStrapiRest<T>(path, init, jwt);
  }
};

/** Keep Strapi's `meta.pagination` and the current request's identity. */
export const requestStrapiRestPayloadAsService = async <T = any>(
  path: string,
  init?: RequestInit,
) => {
  const support = supportContext.getStore();
  const method = (init?.method || "GET").toUpperCase();
  if (support) {
    if (!["GET", "HEAD"].includes(method) && !canSupportWriteStrapi(path, method)) {
      throw Object.assign(new Error("This action is outside support permissions."), { status: 403 });
    }
    // Use the signed-in operator's permissions for reads and writes. Never
    // substitute device/service credentials or retry with a different identity.
    return requestStrapiRest<T>(path, init, support.jwt, false);
  }
  let jwt = await getStrapiJwt(false);

  try {
    return await requestStrapiRest<T>(path, init, jwt, false);
  } catch (error) {
    if ((error as { status?: number }).status !== 401) throw error;
    jwt = await getStrapiJwt(true);
    return requestStrapiRest<T>(path, init, jwt, false);
  }
};

export const requestStrapiRestWithJwt = async <T = any>(
  path: string,
  jwt: string,
  init?: RequestInit,
) => requestStrapiRest<T>(path, init, jwt);

export const registerPortalUserAsService = <T = any>(data: {
  username: string;
  email: string;
  password: string;
  client: string | number;
}) =>
  requestStrapiRestAsService<T>("/api/auth/local/register", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fetchStrapiCatalogEndpoint = async (
  path: string,
  init?: RequestInit,
) => {
  if (supportContext.getStore() && !["GET", "HEAD"].includes((init?.method || "GET").toUpperCase())) {
    throw Object.assign(new Error("Support cannot use device credentials to write."), { status: 403 });
  }
  const catalogToken = process.env.CATALOG_TOKEN;
  return fetch(`${getStrapiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(catalogToken
        ? { Authorization: `Bearer ${catalogToken}` }
        : {}),
      ...(init?.headers || {}),
    },
  });
};

export const hasStrapiCatalogToken = () =>
  Boolean(process.env.CATALOG_TOKEN);
