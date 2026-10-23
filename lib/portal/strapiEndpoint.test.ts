import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { getStrapiBaseUrl } from "../../services/fetchers";

function configure(t: TestContext, server?: string, browser?: string) {
  const originalServer = process.env.STRAPI_URL;
  const originalBrowser = process.env.NEXT_PUBLIC_STRAPI_URL;
  t.after(() => {
    if (originalServer === undefined) delete process.env.STRAPI_URL;
    else process.env.STRAPI_URL = originalServer;
    if (originalBrowser === undefined) delete process.env.NEXT_PUBLIC_STRAPI_URL;
    else process.env.NEXT_PUBLIC_STRAPI_URL = originalBrowser;
  });
  if (server === undefined) delete process.env.STRAPI_URL;
  else process.env.STRAPI_URL = server;
  if (browser === undefined) delete process.env.NEXT_PUBLIC_STRAPI_URL;
  else process.env.NEXT_PUBLIC_STRAPI_URL = browser;
}

test("frontend defaults to production Strapi without a local-backend override", (t) => {
  configure(t);
  assert.equal(getStrapiBaseUrl(), "https://admin.ishaker.xyz");
});

test("explicit server configuration takes precedence and removes a trailing slash", (t) => {
  configure(t, "https://admin.ishaker.xyz/", "http://localhost:1337");
  assert.equal(getStrapiBaseUrl(), "https://admin.ishaker.xyz");
});

test("an explicitly configured development backend remains supported", (t) => {
  configure(t, undefined, "http://localhost:1337/");
  assert.equal(getStrapiBaseUrl(), "http://localhost:1337");
});
