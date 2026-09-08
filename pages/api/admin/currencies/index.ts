import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const parseCurrency = (body: any) => {
  const code = text(body?.code).toUpperCase();
  const name = text(body?.name);
  const symbol = typeof body?.symbol === "string" ? body.symbol : "";
  const symbolPosition = body?.symbolPosition;
  const decimalDigits = Number(body?.decimalDigits);
  const rounding =
    body?.rounding === "" || body?.rounding === null ? 0 : Number(body?.rounding);
  const thousandsSeparator =
    typeof body?.thousandsSeparator === "string"
      ? body.thousandsSeparator
      : ",";
  const decimalSeparator =
    typeof body?.decimalSeparator === "string" ? body.decimalSeparator : ".";

  if (
    !/^[A-Z]{3}$/.test(code) ||
    !name ||
    !symbol ||
    !["before", "after"].includes(symbolPosition) ||
    !Number.isInteger(decimalDigits) ||
    decimalDigits < 0 ||
    decimalDigits > 6 ||
    !Number.isFinite(rounding) ||
    rounding < 0 ||
    thousandsSeparator.length > 4 ||
    !decimalSeparator ||
    decimalSeparator.length > 4
  ) {
    return null;
  }

  return {
    code,
    name,
    symbol,
    symbol_position: symbolPosition,
    decimal_digits: decimalDigits,
    rounding,
    thousands_separator: thousandsSeparator,
    decimal_separator: decimalSeparator,
    isActive: body?.isActive !== false,
  };
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    if (req.method === "GET") {
      const currencies = await requestStrapiRestAsService(
        "/api/currencies?sort[0]=code:ASC&pagination[pageSize]=2000",
      );
      return res.status(200).json({ currencies });
    }

    const data = parseCurrency(req.body);
    if (!data) {
      return res.status(400).json({
        error: "invalid_currency",
        message: "Complete all currency formatting fields with valid values.",
      });
    }
    const currency = await requestStrapiRestAsService("/api/currencies", {
      method: "POST",
      body: JSON.stringify({ data }),
    });
    return res.status(201).json({ currency });
  } catch (error) {
    console.error("[admin/currencies] request failed:", error);
    return res.status(500).json({
      error: "currency_request_failed",
      message: "Currency could not be saved.",
    });
  }
}

export default withAdminApi(handler);
