import assert from "node:assert/strict";
import test from "node:test";
import { assertAppendOnly, assertManifest } from "../scripts/validate-manifest.mjs";

const base = {
  schema: "portfolio-manifest/v1",
  bootstrap: { fixedPdfFingerprint: "a".repeat(64), verificationStatus: "passed" },
  automation: { repeatingPublishEnabled: true },
  versions: [{
    id: "portfolio-v1",
    sourcePdfPath: "assets/versions/portfolio-v1/source.pdf",
    sourceRef: "b".repeat(40),
    pages: [{ ordinal: 1, assetPath: "assets/versions/portfolio-v1/pages/001.webp", width: 1920, height: 1080 }]
  }],
  routes: [{ path: "/acme", companyKey: "acme", versionId: "portfolio-v1" }]
};

test("accepts a complete immutable version and route", () => {
  assert.doesNotThrow(() => assertManifest(base));
});

test("does not allow repeat publishing before bootstrap verification", () => {
  const invalid = structuredClone(base);
  invalid.bootstrap.verificationStatus = "failed";
  assert.throws(() => assertManifest(invalid), /repeating publishing/);
});

test("does not allow published routes to move to another version", () => {
  const current = structuredClone(base);
  current.versions.push({ ...current.versions[0], id: "portfolio-v2", sourcePdfPath: "assets/versions/portfolio-v2/source.pdf", pages: [{ ...current.versions[0].pages[0], assetPath: "assets/versions/portfolio-v2/pages/001.webp" }] });
  current.routes[0].versionId = "portfolio-v2";
  assert.throws(() => assertAppendOnly(base, current), /published route/);
});

test("allows separate company routes to reuse one immutable version", () => {
  const current = structuredClone(base);
  current.routes.push({ path: "/globex", companyKey: "globex", versionId: "portfolio-v1" });
  assert.doesNotThrow(() => assertManifest(current));
  assert.doesNotThrow(() => assertAppendOnly(base, current));
});
