import { withSupportPortalApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { capitalizeName } from "../../../../lib/formatName";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../../../lib/portal/splashOwnership";
import { deleteProductAndAssignments } from "../../../../services/server/deleteProduct";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type {
  PortalCup,
  PortalProductLine,
  PortalSplash,
} from "../../../../types/portal";

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const asId = (value: unknown) => {
  const id = asString(value);
  return /^\d+$/.test(id) ? id : "";
};

const loadVisibleSplash = async (id: string, userId: string | number) => {
  const params = new URLSearchParams();
  params.set("filters[id][$eq]", id);
  params.set("filters[$or][0][author][username][$eq]", "root");
  params.set("filters[$or][1][author][id][$eq]", String(userId));
  params.set("pagination[pageSize]", "1");
  const splashes = await requestWithSplashOwnershipFallback(
    params,
    (query) =>
      requestStrapiRestAsService<PortalSplash[]>(
        `/api/splashes?${query.toString()}`,
      ),
    () =>
      console.warn(
        "[portal/product-lines/id] splash ownership filtering is unsupported; using the compatible query.",
      ),
  );
  return splashes[0] || null;
};

const createOwnershipParams = (
  id: string,
  session: Awaited<ReturnType<typeof getPortalSessionFromApiRequest>>,
) => {
  const params = new URLSearchParams();
  params.set("filters[id][$eq]", id);
  if (session?.access === "client") {
    params.set(
      "filters[author][client][id][$eq]",
      String(session.client.id),
    );
  } else if (session) {
    params.set("filters[author][id][$eq]", String(session.user.id));
  }
  params.set("pagination[pageSize]", "2000");
  return params;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const productLineId = asId(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id);
  if (!productLineId) {
    return res.status(400).json({ error: "invalid_product_line" });
  }

  try {
    const ownedProductLines = await requestStrapiRestAsService<PortalProductLine[]>(
      `/api/product-lines?${createOwnershipParams(productLineId, session).toString()}`,
    );
    const ownedProductLine = ownedProductLines[0];

    if (!ownedProductLine?.id) {
      return res.status(404).json({
        error: "product_line_not_found",
        message: "Product line was not found or does not belong to you.",
      });
    }

    if (req.method === "DELETE") {
      // Cascade all products in the client-owned line so the now-required
      // Product.product_line relation never leaves orphaned records.
      const cascadeParams = new URLSearchParams();
      cascadeParams.set("filters[product_line][id][$eq]", String(ownedProductLine.id));
      cascadeParams.set("fields[0]", "id");
      cascadeParams.set("pagination[pageSize]", "2000");
      const ownedProducts = await requestStrapiRestAsService<{ id: string | number }[]>(
        `/api/products?${cascadeParams.toString()}`,
      );
      const cleanup = await Promise.all(
        ownedProducts.map((product) =>
          deleteProductAndAssignments(product.id),
        ),
      );

      await requestStrapiRestAsService(`/api/product-lines/${ownedProductLine.id}`, {
        method: "DELETE",
      });
      return res.status(200).json({
        deleted: true,
        deletedProducts: ownedProducts.length,
        deletedMachineAssignments: cleanup.reduce(
          (total, result) => total + result.deletedMachineAssignments,
          0,
        ),
        deletedPresetAssignments: cleanup.reduce(
          (total, result) => total + result.deletedPresetAssignments,
          0,
        ),
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")) {
      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({
          error: "invalid_active_state",
          message: "Active state must be true or false.",
        });
      }

      const productLine = await requestStrapiRestAsService<PortalProductLine>(
        `/api/product-lines/${ownedProductLine.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            data: { isActive: req.body.isActive },
          }),
        },
      );
      return res.status(200).json({ productLine });
    }

    const baseProductLineId = asId(req.body?.baseProductLineId);
    const cupId = asId(req.body?.cupId);
    const customSplashId = asId(req.body?.customSplashId);
    if (!baseProductLineId || !cupId) {
      return res.status(400).json({
        error: "missing_selection",
        message: "Base product line and cup are required.",
      });
    }

    const baseParams = new URLSearchParams();
    baseParams.set("filters[id][$eq]", baseProductLineId);
    baseParams.set("filters[author][username][$eq]", "root");
    baseParams.set("populate[cups][fields][0]", "id");
    baseParams.set("pagination[pageSize]", "2000");

    const [baseProductLines, cup, customSplash] =
      await Promise.all([
        requestStrapiRestAsService<PortalProductLine[]>(
          `/api/product-lines?${baseParams.toString()}`,
        ),
        requestStrapiRestAsService<PortalCup>(`/api/cups/${cupId}`),
        customSplashId
          ? loadVisibleSplash(customSplashId, session.user.id)
          : Promise.resolve(null),
      ]);
    const baseProductLine = baseProductLines[0];

    if (!baseProductLine?.id) {
      return res.status(400).json({
        error: "invalid_base_product_line",
        message: "The base product line must belong to root.",
      });
    }

    if (!cup?.id) {
      return res.status(400).json({
        error: "invalid_selection",
        message: "The selected cup no longer exists.",
      });
    }

    if (
      !baseProductLine.cups?.some(
        (assignedCup) => String(assignedCup.id) === String(cup.id),
      )
    ) {
      return res.status(400).json({
        error: "product_line_cup_mismatch",
        message: "A selected cup does not belong to the selected root product line.",
      });
    }

    const name = capitalizeName(baseProductLine.name);
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        error: "invalid_name",
        message: "The selected root product line has an invalid name.",
      });
    }

    const duplicateParams = new URLSearchParams();
    duplicateParams.set("filters[name][$eqi]", name);
    if (session.access === "client") {
      duplicateParams.set(
        "filters[author][client][id][$eq]",
        String(session.client.id),
      );
    } else {
      duplicateParams.set("filters[author][id][$eq]", String(session.user.id));
    }
    duplicateParams.set("filters[id][$ne]", String(ownedProductLine.id));
    duplicateParams.set("pagination[pageSize]", "1");
    const duplicateProductLines =
      await requestStrapiRestAsService<PortalProductLine[]>(
        `/api/product-lines?${duplicateParams.toString()}`,
      );

    if (duplicateProductLines.length) {
      return res.status(409).json({
        error: "duplicate_name",
        message: "A product line with this name already exists.",
      });
    }

    const productLine = await requestStrapiRestAsService<PortalProductLine>(
      `/api/product-lines/${ownedProductLine.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          data: {
            name,
            base_product_line: baseProductLine.id,
            cups: [cup.id],
            custom_splash: customSplash?.id || null,
            ...(session.access === "client" ? { client: session.client.id } : {}),
          },
        }),
      },
    );

    return res.status(200).json({ productLine });
  } catch (error) {
    console.error("[portal/product-lines/:id] request failed:", error);
    return res.status(500).json({
      error: "product_line_request_failed",
      message: `Product line could not be ${req.method === "DELETE" ? "deleted" : "updated"}.`,
    });
  }
}

export default withSupportPortalApi(handler);
