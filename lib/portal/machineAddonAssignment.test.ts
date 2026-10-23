import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import cellsHandler from "../../pages/api/portal/machines/[id]/cells";
import type {
  PortalCatalogProduct,
  PortalMachineCell,
} from "../../types/portal";
import { supportContext } from "../admin/context";

const addon: PortalCatalogProduct = {
  id: 17,
  name: "Creatine",
  is_dependent: true,
  product_type: "powder",
  brand: { id: 2, name: "Test Brand" },
  product_line: { id: 3, name: "Supplements" },
  dosage: { product: 5, full_drink_price: 1.5, water: 0, full_drink_volume: 0, conversion_factor: 4 },
};

async function assignAddon(
  t: TestContext,
  method: "POST" | "PUT",
  product = addon,
  cellCategory = "powder",
) {
  const originalIdentifier = process.env.STRAPI_AUTH_IDENTIFIER;
  const originalPassword = process.env.STRAPI_AUTH_PASSWORD;
  process.env.STRAPI_AUTH_IDENTIFIER = "assignment@example.test";
  process.env.STRAPI_AUTH_PASSWORD = "test-only";
  t.after(() => {
    if (originalIdentifier === undefined)
      delete process.env.STRAPI_AUTH_IDENTIFIER;
    else process.env.STRAPI_AUTH_IDENTIFIER = originalIdentifier;
    if (originalPassword === undefined) delete process.env.STRAPI_AUTH_PASSWORD;
    else process.env.STRAPI_AUTH_PASSWORD = originalPassword;
  });

  let cells: PortalMachineCell[] =
    method === "PUT"
      ? [
          {
            id: 10,
            position: 1,
            isActive: false,
            cell_category: "powder",
            product: null,
            amount_kg: 0,
          },
        ]
      : [];
  const writes: Array<{ method: string; data: any }> = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      if (url.pathname === "/api/auth/local")
        return Response.json({ jwt: "test-token" });
      if (url.pathname === "/api/products") {
        assert.equal(
          url.searchParams.get("filters[author][client][id][$eq]"),
          "1",
        );
        assert.equal(url.searchParams.get("fields[3]"), "is_dependent");
        return Response.json({ data: [product] });
      }
      if (url.pathname.startsWith("/api/machine-cells")) {
        if (!init?.method || init.method === "GET")
          return Response.json({ data: cells });
        const { data } = JSON.parse(String(init.body));
        writes.push({ method: init.method, data });
        cells = [
          {
            id: 10,
            position: data.position,
            product,
            cell_category: data.cell_category,
            isActive: data.isActive,
            amount_kg: data.amount_kg,
            price: data.price,
          },
        ];
        return Response.json({ data: cells[0] });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    },
  );

  const assignment = {
    cellId: method === "PUT" ? 10 : null,
    position: 1,
    productId: product.id,
    isActive: true,
    cellCategory,
    amountKg: 1.5,
  };
  let statusCode = 200;
  let payload: any;
  const req = {
    method,
    query: { id: "5" },
    headers: {},
    body: method === "PUT" ? { assignments: [assignment] } : assignment,
  } as unknown as NextApiRequest;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as NextApiResponse;

  await supportContext.run(
    {
      id: 99,
      username: "support-test",
      jwt: "support-test-token",
      sid: "test-session",
      expiresAt: Date.now() + 60_000,
      updatedAt: "",
      portalSession: {
        user: { id: 11, email: "client@example.test" },
        client: { id: 1, company: "Test" },
        access: "client",
        machines: [
          {
            id: 5,
            serial_number: "test-machine",
            machine_type: { id: 1, name: "Touch", container_count: 8 },
          },
        ],
      },
    },
    () => cellsHandler(req, res),
  );
  return { statusCode, payload, writes };
}

for (const method of ["POST", "PUT"] as const) {
  test(`${method} assigns a priced add-on without artwork, water or drink volume`, async (t) => {
    const result = await assignAddon(t, method);
    assert.equal(result.statusCode, method === "POST" ? 201 : 200);
    assert.equal(result.writes.length, 1);
    assert.equal(result.writes[0].data.product, addon.id);
    assert.equal(result.writes[0].data.cell_category, "powder");
    assert.equal(result.writes[0].data.amount_kg, 1.5);
    assert.equal(result.writes[0].data.price, null);
    assert.equal(result.payload[0].product.is_dependent, true);
  });
}

test("assignment still rejects incomplete drinks and incompatible container types", async (t) => {
  await t.test("incomplete drink", async (subtest) => {
    const result = await assignAddon(subtest, "PUT", {
      ...addon,
      is_dependent: false,
      dosage: { ...addon.dosage, full_drink_price: null },
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.payload.error, "no_usable_price");
    assert.equal(result.writes.length, 0);
  });
  await t.test("powder in a concentrate container", async (subtest) => {
    const result = await assignAddon(subtest, "PUT", addon, "concentrate");
    assert.equal(result.statusCode, 400);
    assert.equal(result.payload.error, "category_mismatch");
    assert.equal(result.writes.length, 0);
  });
});
