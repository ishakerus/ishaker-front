export async function fetchJsonWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
) {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const payload = await response.json().catch((error) => {
      if (controller.signal.aborted) throw error;
      return null;
    });
    return { response, payload };
  } catch (error) {
    if (timedOut) {
      throw Object.assign(new Error("The request took too long. Please try again."), {
        status: 504,
        code: "request_timeout",
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancel);
  }
}
