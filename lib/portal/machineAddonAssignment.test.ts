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
  dosage: {
    product: 5,
    full_drink_price: 1.5,
    water: 0,
    full_drink_volume: 0,
    conversion_factor: 4,
  },
};

async function assignAddon(
  t: TestContext,
  method: "POST" | "PUT",
  product = addon,
  cellCategory = "powder",
  options: {
    position?: number;
    savedPosition?: number;
    powderCount?: number;
    syrupCount?: number;
    maxAmountKg?: number | null;
    savedCapacity?: number | null;
    amountKg?: number;
    strapiError?: string;
    productId?: number | null;
  } = {},
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
            position: options.savedPosition ?? options.position ?? 1,
            isActive: false,
            cell_category: "powder",
            product: null,
            amount_kg: 0,
            max_amount_kg: options.savedCapacity,
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
        if (options.strapiError)
          return Response.json(
            { error: { status: 400, message: options.strapiError } },
            { status: 400 },
          );
        const { data } = JSON.parse(String(init.body));
        writes.push({ method: init.method, data });
        cells = [
          {
            id: 10,
            position: data.position,
            product,
            cell_category:
              data.position > (options.powderCount ?? 8)
                ? "concentrate"
                : "powder",
            isActive: data.isActive,
            amount_kg: data.amount_kg,
            max_amount_kg: data.max_amount_kg ?? options.savedCapacity,
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
    position: options.position ?? 1,
    productId: options.productId === undefined ? product.id : options.productId,
    isActive: true,
    cellCategory,
    amountKg: options.amountKg ?? 1.5,
    ...(options.maxAmountKg !== undefined
      ? { maxAmountKg: options.maxAmountKg }
      : {}),
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
            machine_type: {
              id: 1,
              name: "Touch",
              container_count: options.powderCount ?? 8,
              syrup_container_count: options.syrupCount ?? 0,
            },
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
    assert.equal("cell_category" in result.writes[0].data, false);
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
    const result = await assignAddon(subtest, "PUT", addon, "powder", {
      position: 9,
      syrupCount: 6,
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.payload.error, "category_mismatch");
    assert.equal(result.writes.length, 0);
  });
});

for (const method of ["POST", "PUT"] as const) {
  test(`${method} saves syrup capacity and litres using its physical position`, async (t) => {
    const result = await assignAddon(
      t,
      method,
      { ...addon, product_type: "concentrate" },
      "powder",
      {
        position: 6,
        powderCount: 4,
        syrupCount: 3,
        maxAmountKg: 1.2,
        amountKg: 1,
      },
    );
    assert.equal(result.statusCode, method === "POST" ? 201 : 200);
    assert.equal(result.writes[0].data.position, 6);
    assert.equal(result.writes[0].data.max_amount_kg, 1.2);
    assert.equal(result.writes[0].data.amount_kg, 1);
    assert.equal("cell_category" in result.writes[0].data, false);
    assert.equal(result.payload[0].cell_category, "concentrate");
  });
}

test("client categories cannot turn powder slots into syrup slots", async (t) => {
  const result = await assignAddon(t, "PUT", addon, "concentrate");
  assert.equal(result.statusCode, 200);
  assert.equal("cell_category" in result.writes[0].data, false);
});

test("amount-only edits preserve and clamp to a saved bottle capacity", async (t) => {
  const result = await assignAddon(
    t,
    "PUT",
    { ...addon, product_type: "concentrate" },
    "concentrate",
    {
      position: 6,
      powderCount: 4,
      syrupCount: 3,
      savedCapacity: 0.7,
      amountKg: 2,
    },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.writes[0].data.amount_kg, 0.7);
  assert.equal("max_amount_kg" in result.writes[0].data, false);
});

test("clearing a bottle override uses the 3 litre model default", async (t) => {
  const result = await assignAddon(
    t,
    "PUT",
    { ...addon, product_type: "concentrate" },
    "concentrate",
    {
      position: 6,
      powderCount: 4,
      syrupCount: 3,
      savedCapacity: 0.7,
      maxAmountKg: null,
      amountKg: 4,
    },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.writes[0].data.amount_kg, 3);
  assert.equal(result.writes[0].data.max_amount_kg, null);
});

test("saved physical positions cannot be reassigned", async (t) => {
  const result = await assignAddon(t, "PUT", addon, "powder", {
    position: 2,
    savedPosition: 1,
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.payload.error, "physical_position_changed");
  assert.equal(result.writes.length, 0);
});

test("out-of-range positions and nonpositive capacities are rejected before writing", async (t) => {
  for (const options of [
    { position: 15 },
    { maxAmountKg: 0 },
    { maxAmountKg: -1 },
  ]) {
    await t.test(JSON.stringify(options), async (subtest) => {
      const result = await assignAddon(subtest, "PUT", addon, "powder", {
        syrupCount: 6,
        ...options,
      });
      assert.equal(result.statusCode, 400);
      assert.equal(result.writes.length, 0);
    });
  }
});

test("Strapi validation errors retain their status and readable message", async (t) => {
  const message =
    'Position 6 on machine 118 is a syrup container, but product 1493 "Chocolate Hazelnut" is a powder.';
  const result = await assignAddon(t, "PUT", addon, "powder", {
    strapiError: message,
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.payload.message, message);
});

test("empty syrup slots retain their bottle capacity", async (t) => {
  for (const method of ["POST", "PUT"] as const) {
    await t.test(method, async (subtest) => {
      const result = await assignAddon(subtest, method, addon, "powder", {
        position: 6,
        powderCount: 4,
        syrupCount: 3,
        productId: null,
        maxAmountKg: 1.2,
        amountKg: 0,
      });
      assert.equal(result.statusCode, method === "POST" ? 201 : 200);
      assert.equal(result.writes[0].data.product, null);
      assert.equal(result.writes[0].data.max_amount_kg, 1.2);
    });
  }
});
