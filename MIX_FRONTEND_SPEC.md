# Frontend spec — Mix: pouring one product into another (kiosk patch 72)

## Goal
A kiosk can pour two products into one cup: a **base** drink (e.g. Vanilla Whey Protein) plus an
**addon** (e.g. Strawberry Creatine). The customer picks the ratio on the kiosk's "Check your
order" screen. The portal only decides **which pairs are allowed**. Ratio, grams and price are
not edited in the portal.

A pair works **one way only**: creatine can go into protein, protein never into creatine.

There are two levels:

| level | field | who edits | meaning |
|---|---|---|---|
| product line | `product-line.can_be_added_to` (m2m → product-line) | **iShaker staff only**, on template lines | "products of THIS line may be poured into products of THOSE lines" |
| product | `product.can_be_added_to` (m2m → product) | the client, on their own products | "THIS product may be poured into THOSE products" |
| product | `product.is_dependent` (boolean) | the client | not a drink on its own (pure creatine): never shown as a tile, only added to other drinks |

A client line inherits the allowlist of its template through `base_product_line`, so a client's
own copy of a template line needs no staff edit.

## Backend (done on dev Strapi, `~/DEV/ishaker/strapi`; prod after `deploy-strapi.sh`)
- Schema: the two `can_be_added_to` relations (manyToMany, one-directional, no inverse field) and
  `product.is_dependent` (default false; existing rows are `null`, which means false).
- **Validation lives on the server** (`src/utils/mix-rules.js`, product and product-line
  lifecycles). A refused write returns HTTP 400 with `error.message` in plain English. Show it
  to the user as is. Refused writes:
  - adding a product or line to itself;
  - a reverse pair when the forward one already exists (either level);
  - a product pair not allowed by the lines' allowlist (`Line "X" may not be added to line "Y".`);
  - a target that is `is_dependent`;
  - a target owned by another client;
  - setting `is_dependent=true` on a product that others already use as a base.
- Writes accept a plain id array (`"can_be_added_to": [12, 34]`) or `{connect, disconnect, set}`.
- `/api/machines/:serial/planogram` resolves pairs per machine: a pair exists on a kiosk only
  when **both** products sit in active cells of that machine. Kiosks without patch 72 never
  receive dependent products.
- A dependent product needs grams (`dosage.product`) and `conversion_factor`, but **no price**.
  A mix always costs the base drink's price.

## What to build

### 1. Product line form — staff only (`components/portal/product-lines/ProductLineForm.tsx`)
- Add a multi-select **"Can be added to"** listing product lines (templates, `is_template=true`),
  excluding the line itself.
- Show it only to iShaker staff. Use the same gate the portal already uses for template-line
  editing; do not invent a new role. Clients never see or edit it.
- Read-only hint for clients on their own lines: "Can be added to: Whey Protein, Vegan Protein"
  (resolved through `base_product_line`).

### 2. Product form (`new-product/NewProductForm.tsx` and the product edit page)
- Switch **"Not a drink on its own (add-on only)"** → `is_dependent`.
  - When it is on, hide or relax the price fields: price is not required. Grams and conversion
    factor stay required.
  - Tooltip: "Shown on the kiosk only as an addition to other drinks, at its full dose."
- Multi-select **"Can be added to"** → `can_be_added_to`. Options:
  - the client's own products (same scope the product-lines pages already use);
  - whose line is in this product's line allowlist (template-resolved; see section 1). Filter
    client-side for UX, the server enforces it anyway;
  - excluding itself, excluding `is_dependent` products, and excluding products that already
    list this product (show those greyed with the note "already added to this one").
  - If the allowlist is empty, show the empty state "This product line can't be added to other
    drinks. Ask iShaker support." and no select.
- Save through the existing BFF proxy (`pages/api/portal/product-lines/[id]/products/[productId].ts`).
  Pass `can_be_added_to` and `is_dependent` through. Keep the ownership check as it is.
  Add both fields to the proxy's field allowlist if it has one.

### 3. Product card (`ProductCard.tsx`)
- Badge **"Add-on"** when `is_dependent`.
- Line "Goes into: Vanilla, Chocolate" when `can_be_added_to` is non-empty (names only, max 3,
  then "+N").

### 4. Machine page — "Mixes on this machine" (read-only)
On the machine cells view (`MachineProductLineGrouping.tsx` or next to the cells table), show a
small section computed from the machine's cells:
- For every base product in a cell, list addons whose product is also in a cell of this
  machine: `Container 1 Vanilla Whey ← Container 4 Strawberry Creatine`.
- Warning chip when a product has `can_be_added_to` set but its partner is not loaded on this
  machine: "Strawberry Creatine can go into Vanilla Whey, but Vanilla Whey isn't in any container."
- Warning chip for a cell holding an `is_dependent` product that has no base on the machine:
  "Pure Creatine is add-on only and nothing on this machine accepts it — it will not be sold."

### 5. Preview calculator (optional, nice to have)
In the product form, under "Can be added to", a read-only preview using the TARGET's
`dosage.product`:
- independent addon, ratio 20…80 % in steps of 10: `base = (1 − r) × base g`,
  `addon = r × base g`. Example: 35 g at 40 % gives Vanilla 21 g + Strawberry Creatine 14 g.
- dependent addon: `base g + addon's own dosage.product` (35 g + 5 g).
- Price line: "Price: same as the base drink".

### 6. Sales (later, not required now)
`sale` gained `mix_ratio` (integer %, null for a dependent addon). Mixed sales carry
`addon_product`, `addon_g`, `mix_ratio`, and `product_name` like `"Vanilla + 40% strawberry"`.
If the portal has a sales table, show `addon_product` and `mix_ratio` in the row detail.

## Out of scope
- Ratio bounds (20 / 80 / 10). They are sent in the planogram (`body.fleetMix`) and are not
  editable in the portal.
- More than one addon per cup. The machine hardware has one secondary dispenser slot.
- Shaker S machines. Mixing is Touch 2 only for now; don't hide the fields, the kiosk ignores them.

## Acceptance
1. As staff, allow line "Pre Training" → "Whey Protein". As client, set Watermelon (Pre
   Training) → can be added to Chocolate Hazelnut (Whey). Save works.
2. Trying Chocolate Hazelnut → Watermelon (reverse) shows the server error text.
3. `GET /api/machines/<serial>/planogram` with header `X-Fleet-Mix: 1` shows `mixAddons: [<Watermelon id>]`
   on Chocolate Hazelnut once both are in that machine's cells.
4. Marking Chocolate Hazelnut `is_dependent` is refused while Watermelon points at it.
