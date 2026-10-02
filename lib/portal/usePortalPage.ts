import { useRouter } from "next/router";
import { useEffect } from "react";
import useSWR from "swr";

type PortalErrorPayload = {
  error?: string;
  message?: string;
};

export class PortalPageError extends Error {
  status: number;
  payload: PortalErrorPayload | null;

  constructor(
    status: number,
    payload: PortalErrorPayload | null,
    fallbackMessage = "The page could not be loaded.",
  ) {
    super(payload?.message || fallbackMessage);
    this.name = "PortalPageError";
    this.status = status;
    this.payload = payload;
  }
}

const fetchPortalPage = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PortalPageError(response.status, payload);
  }
  return payload as T;
};

export const usePortalPage = <T,>(
  key: string | null,
  options: { refreshInterval?: number } = {},
) => {
  const router = useRouter();
  const result = useSWR<T, PortalPageError>(key, fetchPortalPage, {
    dedupingInterval: 5_000,
    refreshInterval: options.refreshInterval || 0,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: true,
    keepPreviousData: true,
    errorRetryCount: 2,
    shouldRetryOnError: (error) => ![401, 403, 404].includes(error.status),
  });

  useEffect(() => {
    const errorCode = result.error?.payload?.error;
    const destination =
      result.error?.status === 401
        ? errorCode === "support_session_expired"
          ? "/admin/dashboard"
          : "/login"
        : result.error?.status === 403 &&
            errorCode === "product_access_required"
          ? "/product-lines"
          : null;
    if (!destination) return;
    void router.replace(destination);
  }, [result.error, router]);

  return result;
};
