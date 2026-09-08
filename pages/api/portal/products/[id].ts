import { withSupportPortalApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { deleteProductAndAssignments } from "../../../../services/server/deleteProduct";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type { PortalProduct } from "../../../../types/portal";

const asId = (value: unknown) => {
  const id = typeof value === "string" ? value.trim() : "";
  return /^\d+$/.test(id) ? id : "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "PATCH", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const productId = asId(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id);
  if (!productId) return res.status(400).json({ error: "invalid_product" });

  if (req.method === "DELETE" || req.method === "PATCH") {
    const ownershipParams = new URLSearchParams();
    ownershipParams.set("filters[id][$eq]", productId);
    ownershipParams.set("filters[product_line][id][$null]", "true");
    if (session.access === "client") {
      ownershipParams.set(
        "filters[author][client][id][$eq]",
        String(session.client.id),
      );
    } else {
      ownershipParams.set(
        "filters[author][id][$eq]",
        String(session.user.id),
      );
    }
    ownershipParams.set("fields[0]", "id");
    ownershipParams.set("pagination[pageSize]", "1");

    try {
      const products = await requestStrapiRestAsService<PortalProduct[]>(
        `/api/products?${ownershipParams.toString()}`,
      );
      if (!products[0]) {
        return res.status(404).json({
          error: "orphan_not_found",
          message: "This orphan product was not found.",
        });
      }

      if (req.method === "PATCH") {
        const targetId = asId(
          typeof req.body?.productLineId === "number"
            ? String(req.body.productLineId)
            : req.body?.productLineId,
        );
        if (!targetId) {
          return res.status(400).json({
            error: "invalid_product_line",
            message: "Choose a product line.",
          });
        }
        const lineParams = new URLSearchParams();
        lineParams.set("filters[id][$eq]", targetId);
        if (session.access === "client") {
          lineParams.set(
            "filters[author][client][id][$eq]",
            String(session.client.id),
          );
        } else {
          lineParams.set(
            "filters[author][id][$eq]",
            String(session.user.id),
          );
        }
        lineParams.set("fields[0]", "id");
        lineParams.set("pagination[pageSize]", "1");
        const productLines = await requestStrapiRestAsService<
          Array<{ id: string | number }>
        >(`/api/product-lines?${lineParams.toString()}`);
        if (!productLines[0]) {
          return res.status(404).json({
            error: "product_line_not_found",
            message: "Product line was not found.",
          });
        }
        await requestStrapiRestAsService(`/api/products/${productId}`, {
          method: "PUT",
          body: JSON.stringify({ data: { product_line: Number(targetId) } }),
        });
        return res.status(200).json({
          product: { id: Number(productId), product_line: Number(targetId) },
          updatedInPlace: true,
        });
      }

      const cleanup = await deleteProductAndAssignments(productId);
      return res.status(200).json({ deleted: true, ...cleanup });
    } catch (error) {
      console.error("[portal/products/:id] orphan mutation failed:", error);
      return res.status(500).json({
        error: "product_mutation_failed",
        message:
          req.method === "PATCH"
            ? "Product could not be attached."
            : "Product could not be deleted.",
      });
    }
  }

  const params = new URLSearchParams();
  params.set("filters[id][$eq]", productId);
  if (session.access === "client") {
    params.set("filters[$or][0][author][username][$eq]", "root");
    params.set(
      "filters[$or][1][author][client][id][$eq]",
      String(session.client.id),
    );
  } else {
    params.set("filters[author][id][$eq]", String(session.user.id));
  }
  params.set("fields[0]", "name");
  params.set("fields[1]", "description");
  params.set("fields[2]", "product_type");
  params.set("fields[3]", "serving_qty");
  params.set("fields[4]", "serving_unit");
  params.set("fields[5]", "product_purpose");
  params.set("populate[custom_main][fields][0]", "url");
  params.set("populate[custom_main][fields][1]", "formats");
  params.set("populate[cup][populate][image][fields][0]", "url");
  params.set("populate[cup][populate][image][fields][1]", "formats");
  params.set("populate[custom_splash][fields][0]", "isEmpty");
  params.set("populate[custom_splash][populate][images][fields][0]", "url");
  params.set("populate[custom_splash][populate][images][fields][1]", "name");
  params.set("populate[custom_circle][fields][0]", "name");
  params.set("populate[custom_circle][populate][images][fields][0]", "url");
  params.set("populate[custom_circle][populate][images][fields][1]", "formats");
  params.set("populate[taste][populate][default_splash][populate][images][fields][0]", "url");
  params.set("populate[taste][populate][default_splash][populate][images][fields][1]", "name");
  params.set("populate[taste][populate][default_splash][fields][0]", "isEmpty");
  params.set("populate[taste][populate][default_splash][fields][1]", "name");
  params.set("populate[taste][populate][default_circle][fields][0]", "name");
  params.set("populate[taste][populate][main][fields][0]", "url");
  params.set("populate[taste][populate][main][fields][1]", "formats");
  params.set("populate[components][fields][0]", "name");
  params.set("populate[components][fields][1]", "unit");
  params.set("populate[components][fields][2]", "default_value");
  params.set("populate[nutrition]", "*");
  params.set("populate[dosage]", "*");
  params.set("populate[brand][fields][0]", "name");
  params.set("populate[brand][populate][logo][fields][0]", "url");
  params.set("populate[brand][populate][logo][fields][1]", "formats");
  params.set("pagination[pageSize]", "1");

  try {
    const products = await requestStrapiRestAsService<PortalProduct[]>(
      `/api/products?${params.toString()}`,
    );
    const product = products[0];
    if (!product) {
      return res.status(404).json({
        error: "product_not_found",
        message: "Product could not be loaded.",
      });
    }
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ product });
  } catch (error) {
    console.error("[portal/products/:id] loading failed:", error);
    return res.status(404).json({
      error: "product_not_found",
      message: "Product could not be loaded.",
    });
  }
}

export default withSupportPortalApi(handler);
