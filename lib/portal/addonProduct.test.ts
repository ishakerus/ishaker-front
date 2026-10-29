import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import { handler } from "../../pages/api/portal/product-lines/[id]/products";
import { supportContext } from "../admin/context";

const addon = {
  name: "Creatine",
  brandId: "2",
  isDependent: true,
  dosage: { product: 5, fullDrinkPrice: 1.5 },
};

async function submitProduct(
  t: TestContext,
  body: Record<string, unknown>,
  options: {
    method?: string;
    ownsLine?: boolean;
    ownsProduct?: boolean;
    duplicate?: boolean;
    existingMode?: boolean | null;
    existingOwner?: "unowned" | "another_client";
    clientAccess?: boolean;
    lineType?: "powder" | "concentrate";
  } = {},
) {
  const writes: Array<{ path: string; method: string; data: any }> = [];
  const reads: string[] = [];
  const originalIdentifier = process.env.STRAPI_AUTH_IDENTIFIER;
  const originalPassword = process.env.STRAPI_AUTH_PASSWORD;
  process.env.STRAPI_AUTH_IDENTIFIER = "addon-test@example.test";
  process.env.STRAPI_AUTH_PASSWORD = "test-only";
  t.after(() => {
    if (originalIdentifier === undefined)
      delete process.env.STRAPI_AUTH_IDENTIFIER;
    else process.env.STRAPI_AUTH_IDENTIFIER = originalIdentifier;
    if (originalPassword === undefined) delete process.env.STRAPI_AUTH_PASSWORD;
    else process.env.STRAPI_AUTH_PASSWORD = originalPassword;
  });

  t.mock.method(
    globalThis,
    "fetch",
    async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      const method = init?.method || "GET";
      const json = (value: unknown) => Response.json(value);
      if (url.pathname === "/api/auth/local")
        return json({ jwt: "test-service-token" });
      if (method !== "GET") {
        const { data } = JSON.parse(String(init?.body));
        writes.push({ path: url.pathname, method, data });
        return json({ data: { id: 7, attributes: { name: data.name } } });
      }
      reads.push(url.pathname);
      if (url.pathname === "/api/product-lines") {
        assert.equal(url.searchParams.get(options.clientAccess
          ? "filters[author][client][id][$eq]"
          : "filters[author][id][$eq]"), options.clientAccess ? "30" : "11");
        return json({
          data:
            options.ownsLine === false
              ? []
              : [
                  {
                    id: 3,
                    name: "Supplements",
                    product_type: options.lineType,
                    products:
                      options.ownsProduct === false
                        ? []
                        : [{ id: 7, name: "Creatine" }],
                    base_product_line: { id: 1 },
                    machines: [],
                  },
                ],
        });
      }
      if (url.pathname === "/api/brands/2") return json({ data: { id: 2 } });
      if (url.pathname === "/api/products") {
        const ownerScope = url.searchParams.get(options.clientAccess
          ? "filters[author][client][id][$eq]"
          : "filters[author][id][$eq]");
        assert.equal(ownerScope, options.clientAccess ? "30" : "11");
        const addonOnly = url.searchParams.get("filters[is_dependent][$eq]") === "true";
        if (body.isDependent === true) {
          assert.equal(addonOnly, true);
        } else {
          assert.equal(url.searchParams.get("filters[$or][0][is_dependent][$eq]"), "false");
          assert.equal(url.searchParams.get("filters[$or][1][is_dependent][$null]"), "true");
        }
        const matchesMode = options.existingMode !== undefined &&
          (options.existingMode === true) === addonOnly;
        const hiddenDuplicate = options.existingOwner && !ownerScope;
        return json({
          data: options.duplicate || matchesMode || hiddenDuplicate ? [{ id: 8, name: "Creatine" }] : [],
        });
      }
      if (url.pathname === "/api/products/7") {
        return json({
          data: {
            id: 7,
            name: "Creatine",
            dosage: { conversion_factor: 3.25 },
          },
        });
      }
      if (url.pathname === "/api/splashes") return json({ data: [{ id: 4 }] });
      if (url.pathname === "/api/circles/5") return json({ data: { id: 5 } });
      if (url.pathname === "/api/upload/files/6") return json({ id: 6 });
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    },
  );

  const req = {
    method: options.method || "POST",
    query: { id: "3" },
    headers: {},
    body,
  } as unknown as NextApiRequest;
  let statusCode = 200;
  let payload: any;
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
      username: "test-support",
      jwt: "test-support-token",
      sid: "test-session",
      expiresAt: Date.now() + 60_000,
      updatedAt: "",
      portalSession: {
        user: { id: 11, email: "product@example.test" },
        client: { id: options.clientAccess ? 30 : 0, company: "Test" },
        access: options.clientAccess ? "client" : "product",
        machines: [],
      },
    },
    () => handler(req, res),
  );
  return { statusCode, payload, writes, reads };
}

test("creates an add-on with only name, brand, one dosage and price", async (t) => {
  const result = await submitProduct(t, addon);
  assert.equal(result.statusCode, 201);
  assert.equal(result.writes.length, 1);
  const { data } = result.writes[0];
  assert.equal(data.is_dependent, true);
  assert.equal(data.dosage.product, 5);
  assert.equal(data.dosage.water, 0);
  assert.equal(data.dosage.full_drink_volume, 0);
  assert.equal(data.dosage.full_drink_price, 1.5);
  assert.equal(data.dosage.small_drink_volume, null);
  assert.equal(data.dosage.small_drink_price, null);
  assert.deepEqual(data.components, { set: [] });
  assert.deepEqual(data.nutrition, []);
  assert.equal(
    result.reads.some((path) =>
      /splashes|circles|upload|components|cups/.test(path),
    ),
    false,
  );
});

test("hidden unowned or foreign products do not block an add-on in the user's library", async (t) => {
  for (const clientAccess of [true, false]) {
    for (const existingOwner of ["unowned", "another_client"] as const) {
      await t.test(`${clientAccess ? "client" : "product"} access, ${existingOwner}`, async (subtest) => {
        const result = await submitProduct(subtest, addon, { existingOwner, clientAccess });
        assert.equal(result.statusCode, 201);
        assert.equal(result.writes.length, 1);
        assert.equal(result.writes[0].data.author, 11);
      });
    }
  }
});

test("a visible same-name add-on still blocks duplicates for client accounts", async (t) => {
  const result = await submitProduct(t, addon, { duplicate: true, clientAccess: true });
  assert.equal(result.statusCode, 409);
  assert.equal(result.writes.length, 0);
});

test("add-on names accept 20 characters and reject 21 on create and edit", async (t) => {
  for (const method of ["POST", "PUT"]) {
    for (const length of [20, 21]) {
      await t.test(`${method} ${length} characters`, async (subtest) => {
        const result = await submitProduct(subtest, {
          ...addon,
          name: "A".repeat(length),
          ...(method === "PUT" ? { existingProductId: "7" } : {}),
        }, { method });
        assert.equal(result.statusCode, length === 21 ? 400 : method === "PUT" ? 200 : 201);
        if (length === 21) {
          assert.equal(result.payload.error, "invalid_name");
          assert.match(result.payload.message, /20 characters/);
          assert.equal(result.writes.length, 0);
        }
      });
    }
  }
});

test("editing an add-on preserves its calibration and existing mix targets", async (t) => {
  const result = await submitProduct(
    t,
    { ...addon, existingProductId: "7" },
    { method: "PUT" },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.updatedInPlace, true);
  assert.equal(result.writes[0].path, "/api/products/7");
  assert.equal(result.writes[0].data.dosage.conversion_factor, 3.25);
  assert.equal(result.writes[0].data.dosage.full_drink_price, 1.5);
  assert.equal("can_be_added_to" in result.writes[0].data, false);
});

for (const method of ["POST", "PUT"]) {
  test(`${method} saves the selected drinks for an add-on`, async (t) => {
    const result = await submitProduct(
      t,
      {
        ...addon,
        ...(method === "PUT" ? { existingProductId: "7" } : {}),
        canBeAddedToIds: ["8", "9"],
      },
      { method },
    );
    assert.equal(result.statusCode, method === "POST" ? 201 : 200);
    assert.deepEqual(result.writes[0].data.can_be_added_to, [8, 9]);
  });
}

test("removing all selected drinks clears an add-on's pairings", async (t) => {
  const result = await submitProduct(
    t,
    { ...addon, existingProductId: "7", canBeAddedToIds: [] },
    { method: "PUT" },
  );
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.writes[0].data.can_be_added_to, []);
});

test("add-on pairings reject duplicate and invalid drink IDs", async (t) => {
  for (const canBeAddedToIds of [["8", "8"], ["invalid"]]) {
    await t.test(JSON.stringify(canBeAddedToIds), async (subtest) => {
      const result = await submitProduct(subtest, { ...addon, canBeAddedToIds });
      assert.equal(result.statusCode, 400);
      assert.equal(result.payload.error, "invalid_mix_targets");
      assert.equal(result.writes.length, 0);
    });
  }
});

test("converting a drink ignores stale drink fields and clears nutrition and sizes", async (t) => {
  const result = await submitProduct(
    t,
    {
      ...addon,
      existingProductId: "7",
      components: [{ name: "Incomplete component" }],
      dosage: {
        product: 2.5,
        water: 900,
        fullDrinkVolume: -10,
        smallDrinkVolume: 200,
        fullDrinkPrice: 10,
      },
      cupId: "123",
    },
    { method: "PUT" },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.writes[0].data.dosage.product, 2.5);
  assert.equal(result.writes[0].data.dosage.full_drink_price, 10);
  assert.equal(result.writes[0].data.dosage.small_drink_volume, null);
  assert.deepEqual(result.writes[0].data.nutrition, []);
});

for (const amount of [undefined, "", 0, -1, "NaN", "Infinity"]) {
  test(`rejects invalid add-on dosage ${JSON.stringify(amount)}`, async (t) => {
    const result = await submitProduct(t, {
      ...addon,
      dosage: { ...addon.dosage, product: amount },
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.payload.error, "invalid_dosage");
    assert.equal(result.writes.length, 0);
  });
}

for (const price of [0, 0.02, "1.25"]) {
  test(`saves add-on price ${JSON.stringify(price)} per full dose`, async (t) => {
    const result = await submitProduct(t, {
      ...addon,
      dosage: { ...addon.dosage, fullDrinkPrice: price },
    });
    assert.equal(result.statusCode, 201);
    assert.equal(result.writes[0].data.dosage.full_drink_price, Number(price));
  });
}

for (const price of [undefined, null, "", " ", -1, 0.01, "NaN", "Infinity", true, []]) {
  test(`rejects invalid add-on price ${JSON.stringify(price)}`, async (t) => {
    const result = await submitProduct(t, {
      ...addon,
      dosage: { ...addon.dosage, fullDrinkPrice: price },
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.payload.error, "invalid_dosage");
    assert.equal(result.writes.length, 0);
  });
}

test("add-ons retain line and product ownership checks and duplicate protection", async (t) => {
  for (const options of [
    { ownsLine: false },
    { method: "PUT", ownsProduct: false },
    { duplicate: true },
  ]) {
    await t.test(JSON.stringify(options), async (subtest) => {
      const result = await submitProduct(
        subtest,
        { ...addon, existingProductId: "7" },
        options,
      );
      assert.equal(result.statusCode, options.duplicate ? 409 : 404);
      assert.equal(result.writes.length, 0);
    });
  }
});

const drink = {
  ...addon,
  isDependent: false,
  splashId: "4",
  circleId: "5",
  mainImageId: "6",
  components: [],
  productType: "powder",
  productPurpose: "sport nutrition",
  servingQty: 100,
  servingUnit: "g",
  canBeAddedToIds: [],
  dosage: {
    fullDrinkVolume: 300,
    fullDrinkPrice: 5.49,
    water: 270,
    product: 30,
    conversionFactor: 4,
  },
};

test("a drink and add-on may share a name within one product line", async (t) => {
  for (const [body, existingMode] of [[addon, false], [addon, null], [drink, true]] as const) {
    await t.test(`saving ${body.isDependent ? "add-on" : "drink"} beside ${existingMode}`, async (subtest) => {
      const result = await submitProduct(subtest, body, { existingMode });
      assert.equal(result.statusCode, 201);
      assert.equal(result.writes.length, 1);
    });
  }
});

test("same-mode names remain unique, including legacy drinks without a mode", async (t) => {
  for (const [body, existingMode] of [[addon, true], [drink, false], [drink, null]] as const) {
    await t.test(`saving ${body.isDependent ? "add-on" : "drink"} beside ${existingMode}`, async (subtest) => {
      const result = await submitProduct(subtest, body, { existingMode });
      assert.equal(result.statusCode, 409);
      assert.equal(result.payload.error, "duplicate_name");
      assert.equal(result.writes.length, 0);
    });
  }
});

test("drinks still require artwork and valid water amounts", async (t) => {
  await t.test("artwork", async (subtest) => {
    const result = await submitProduct(subtest, {
      ...drink,
      splashId: undefined,
    });
    assert.equal(result.payload.error, "invalid_visuals");
    assert.equal(result.writes.length, 0);
  });
  await t.test("water", async (subtest) => {
    const result = await submitProduct(subtest, {
      ...drink,
      dosage: { ...drink.dosage, water: 10 },
    });
    assert.equal(result.payload.error, "water_out_of_range");
    assert.equal(result.writes.length, 0);
  });
});

test("the existing drink creation flow still saves the full recipe", async (t) => {
  const result = await submitProduct(t, { ...drink, canBeAddedToIds: ["8", "9"] });
  assert.equal(result.statusCode, 201);
  assert.equal(result.writes[0].data.is_dependent, false);
  assert.equal(result.writes[0].data.dosage.full_drink_volume, 300);
  assert.equal(result.writes[0].data.custom_main, 6);
  assert.deepEqual(result.writes[0].data.can_be_added_to, [8, 9]);
});

test("new products inherit concentrate and ml from their product line", async (t) => {
  for (const body of [addon, { ...drink, productType: undefined, servingUnit: undefined }]) {
    await t.test(body.isDependent ? "add-on" : "drink", async (subtest) => {
      const result = await submitProduct(subtest, body, { lineType: "concentrate" });
      assert.equal(result.statusCode, 201);
      assert.equal(result.writes[0].data.product_type, "concentrate");
      assert.equal(result.writes[0].data.serving_unit, "ml");
    });
  }
});

test("explicit product types and serving units are preserved in concentrate lines", async (t) => {
  const result = await submitProduct(t, drink, { lineType: "concentrate" });
  assert.equal(result.statusCode, 201);
  assert.equal(result.writes[0].data.product_type, "powder");
  assert.equal(result.writes[0].data.serving_unit, "g");
});
