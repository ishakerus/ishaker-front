import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPromoQrUrl,
  isQrSafePromoCode,
  PROMO_QR_CODE_RE,
} from "./promoQr";

test("QR-safe promo codes accept supported characters after trim and uppercase", () => {
  assert.equal(isQrSafePromoCode(" summer-25 "), true);
  assert.equal(isQrSafePromoCode("save_20"), true);
  assert.equal(PROMO_QR_CODE_RE.test("SUMMER-25"), true);
});

test("QR-safe promo codes reject unsupported characters and excessive length", () => {
  assert.equal(isQrSafePromoCode("A B"), false);
  assert.equal(isQrSafePromoCode("Ä1"), false);
  assert.equal(isQrSafePromoCode("A".repeat(33)), false);
});

test("promo QR URLs normalize the code and remove trailing origin slashes", () => {
  assert.equal(
    buildPromoQrUrl(" summer-25 ", "https://example.com///"),
    "https://example.com/p/SUMMER-25",
  );
});
