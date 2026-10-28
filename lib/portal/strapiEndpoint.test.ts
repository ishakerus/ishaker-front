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

test("frontend uses production Strapi without environment configuration", (t) => {
  configure(t);
  assert.equal(getStrapiBaseUrl(), "https://admin.ishaker.xyz");
});

test("a browser override cannot redirect requests to local Strapi", (t) => {
  configure(t, "https://admin.ishaker.xyz/", "http://localhost:1337");
  assert.equal(getStrapiBaseUrl(), "https://admin.ishaker.xyz");
});

test("a browser-only development backend override is ignored", (t) => {
  configure(t, undefined, "http://localhost:1337/");
  assert.equal(getStrapiBaseUrl(), "https://admin.ishaker.xyz");
});

test("a server development backend override is ignored", (t) => {
  configure(t, "http://localhost:1337", "https://admin.ishaker.xyz");
  assert.equal(getStrapiBaseUrl(), "https://admin.ishaker.xyz");
});

test("neither server nor browser configuration can select a development backend", (t) => {
  configure(t, "http://127.0.0.1:1337", "https://dev.ishaker.xyz");
  assert.equal(getStrapiBaseUrl(), "https://admin.ishaker.xyz");
});
