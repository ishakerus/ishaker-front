import { withSupportPortalApi } from "../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../lib/portal/auth";
import normalize from "../../../services/normalizer";
import { requestStrapiRestPayloadAsService } from "../../../services/server/strapiClient";
import type { Sale } from "../../../types/strapi";

type StrapiSalesResponse = {
  data?: unknown[];
  meta?: { pagination?: { page?: number; pageSize?: number; pageCount?: number; total?: number } };
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

const dateBoundary = (value: string, endOfDay: boolean) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const addSaleQuery = (
  params: URLSearchParams,
  clientId: string | number,
  machineId: string,
  from: string,
  to: string,
) => {
  params.set("filters[client][id][$eq]", String(clientId));
  params.set("filters[outcome][$eq]", "dispensed");
  params.set("filters[source][$in][0]", "kiosk");
  params.set("filters[source][$in][1]", "csv_harvest");
  if (machineId) params.set("filters[machine][id][$eq]", machineId);
  if (from) params.set("filters[occurred_at][$gte]", from);
  if (to) params.set("filters[occurred_at][$lte]", to);
  [
    "sale_uuid", "source", "outcome", "amount", "currency_code",
    "payment_method", "product_name", "occurred_at", "occurred_at_local",
    "machine_tz", "cell_position", "cup_size", "drink_volume_ml", "list_price",
    "discount_amount", "promo_code", "is_free", "is_mix", "powder_g",
    "water_ml", "cups_used", "writeoffs", "remains_after", "raw",
  ].forEach((field, index) => params.set(`fields[${index}]`, field));
  params.set("populate[machine][fields][0]", "serial_number");
  params.set("populate[machine][populate][currency]", "*");
  params.set("populate[currency]", "*");
  params.set("populate[product][fields][0]", "name");
  params.set("populate[taste][fields][0]", "name");
  params.set("populate[taste_2][fields][0]", "name");
  params.set("populate[cup][fields][0]", "name");
  params.set("sort[0]", "occurred_at:DESC");
};

const csvCell = (value: unknown) => {
  let cell = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
};

const salesCsv = (sales: Sale[]) => {
  const rows = sales.map((sale) => [
    sale.occurred_at_local || sale.occurred_at || "",
    sale.machine?.serial_number || "",
    sale.product_name || sale.product?.name || "",
    sale.taste?.name || "", sale.cup_size || "", sale.cell_position ?? "",
    sale.list_price ?? "", sale.amount ?? "",
    sale.currency_code || sale.currency?.code || sale.machine?.currency?.code || "",
    sale.payment_method || "", sale.is_free ? "FREE" : "", sale.is_mix ? "MIX" : "",
    sale.powder_g ?? "", sale.water_ml ?? "", sale.cups_used ?? "",
  ]);
  return [
    ["time_local", "machine", "product", "taste", "size", "cell", "list_price", "paid", "currency", "payment_method", "free", "mix", "powder_g", "water_ml", "cups_used"],
    ...rows,
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client" || !session.client.id) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const machineId = first(req.query.machineId).trim();
  if (machineId) {
    const machine = /^\d+$/.test(machineId)
      ? await assertMachineBelongsToSessionClient(session, machineId) : null;
    if (!machine) return res.status(403).json({ error: "machine_access_denied" });
  }
  const rawFrom = first(req.query.from).trim();
  const rawTo = first(req.query.to).trim();
  const from = dateBoundary(rawFrom, false);
  const to = dateBoundary(rawTo, true);
  if ((rawFrom && !from) || (rawTo && !to) || (from && to && from > to)) {
    return res.status(400).json({ error: "invalid_date_range", message: "Enter a valid sales date range." });
  }
  const page = Math.max(1, Number(first(req.query.page)) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(first(req.query.pageSize)) || 25));
  const params = new URLSearchParams();
  addSaleQuery(params, session.client.id, machineId, from, to);

  try {
    if (first(req.query.format) === "csv") {
      params.set("pagination[pageSize]", "500");
      const exported: Sale[] = [];
      for (let sourcePage = 1; sourcePage <= 40; sourcePage += 1) {
        params.set("pagination[page]", String(sourcePage));
        const payload = await requestStrapiRestPayloadAsService<StrapiSalesResponse>(`/api/sales?${params.toString()}`);
        exported.push(...(normalize(payload.data || []) as Sale[]));
        if (sourcePage >= Number(payload.meta?.pagination?.pageCount || 1)) break;
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="kiosk-sales.csv"');
      return res.status(200).send(`\uFEFF${salesCsv(exported)}`);
    }
    params.set("pagination[page]", String(page));
    params.set("pagination[pageSize]", String(pageSize));
    const result = await requestStrapiRestPayloadAsService<StrapiSalesResponse>(`/api/sales?${params.toString()}`);
    const pagination = result.meta?.pagination;
    return res.status(200).json({
      sales: normalize(result.data || []) as Sale[],
      pagination: {
        page: pagination?.page || page, pageSize: pagination?.pageSize || pageSize,
        pageCount: pagination?.pageCount || 1, total: pagination?.total || 0,
      },
      nayax: {
        status: session.client.nayax_status || "unconfigured",
        error: session.client.nayax_error || null,
        lastSyncAt: session.client.nayax_last_sync_at || null,
      },
    });
  } catch (error) {
    console.error("[portal/sales] load failed:", error);
    return res.status(500).json({ error: "sales_load_failed", message: "Sales could not be loaded." });
  }
}

export default withSupportPortalApi(handler);
