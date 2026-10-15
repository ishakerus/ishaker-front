import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMediaFilename } from "./mediaFilename";
import { recoverPortalTasteClient, type RecoverableTaste } from "./tasteAuthorRecovery";

const taste = (): RecoverableTaste => ({
  id: 271,
  name: "Broccoli Garlic",
  author: null,
  default_splash: {
    name: "Broccoli Garlic custom splash",
    author: { username: "client-user", client: { id: 12, company: "Client" } },
    images: Array.from({ length: 20 }, (_, index) => ({ name: normalizeMediaFilename(`taste-Broccoli-Garlic_${String(index + 1).padStart(2, "0")}.png`) })),
  },
});

test("restore the client only from the portal's complete generated splash", () => {
  assert.equal(recoverPortalTasteClient(taste()), 12);
});
test("never change an existing taste owner", () => {
  const record = taste(); record.author = { id: 13 };
  assert.equal(recoverPortalTasteClient(record), null);
});
test("root user and root client tastes stay read-only", () => {
  const userRoot = taste(); userRoot.default_splash!.author!.username = "root";
  const clientRoot = taste(); clientRoot.default_splash!.author!.client!.company = " Root ";
  assert.equal(recoverPortalTasteClient(userRoot), null);
  assert.equal(recoverPortalTasteClient(clientRoot), null);
});
test("legacy tastes and splashes without a client are not assigned", () => {
  assert.equal(recoverPortalTasteClient({ id: 1, name: "Legacy" }), null);
  const record = taste(); record.default_splash!.author!.client = null;
  assert.equal(recoverPortalTasteClient(record), null);
});
test("unrelated, incomplete and duplicate frames cannot establish ownership", () => {
  const unrelated = taste(); unrelated.default_splash!.name = "Color Mint";
  const incomplete = taste(); incomplete.default_splash!.images!.pop();
  const duplicate = taste(); duplicate.default_splash!.images![19] = duplicate.default_splash!.images![0];
  const wrongName = taste(); wrongName.default_splash!.images![0].name = "unrelated.png";
  for (const record of [unrelated, incomplete, duplicate, wrongName]) assert.equal(recoverPortalTasteClient(record), null);
});
