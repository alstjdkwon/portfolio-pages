import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildViewer } from "../scripts/build-viewer.mjs";

const manifest = {
  schema: "portfolio-manifest/v1",
  bootstrap: { fixedPdfFingerprint: "a".repeat(64), verificationStatus: "passed" },
  automation: { repeatingPublishEnabled: true },
  versions: [{
    id: "portfolio-v1",
    sourcePdfPath: "assets/versions/portfolio-v1/source.pdf",
    sourceRef: "b".repeat(40),
    pages: [
      { ordinal: 1, assetPath: "assets/versions/portfolio-v1/pages/001.png", width: 1920, height: 1080 },
      { ordinal: 2, assetPath: "assets/versions/portfolio-v1/pages/002.png", width: 1080, height: 1920 }
    ]
  }],
  routes: [{ path: "/acme", companyKey: "acme", versionId: "portfolio-v1" }]
};

test("builds an unauthenticated, ordered vertical viewer with intrinsic page dimensions", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-viewer-test-"));
  const manifestPath = join(directory, "manifest.json");
  const outputDirectory = join(directory, "site");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(manifestPath, JSON.stringify(manifest));

  await buildViewer({ manifestPath, outputDirectory });

  const html = await readFile(join(outputDirectory, "acme", "index.html"), "utf8");
  const images = [...html.matchAll(/<img\s+([^>]+)>/g)].map((match) => match[1]);
  assert.equal(images.length, 2);
  assert.match(html, /<html lang="ko">/);
  assert.match(images[0], /src="\.\.\/assets\/versions\/portfolio-v1\/pages\/001\.png"/);
  assert.match(images[0], /width="1920"/);
  assert.match(images[0], /height="1080"/);
  assert.match(images[1], /src="\.\.\/assets\/versions\/portfolio-v1\/pages\/002\.png"/);
  assert.match(images[1], /width="1080"/);
  assert.match(images[1], /height="1920"/);
  assert.match(html, /\.portfolio-page img\s*\{[^}]*height:\s*auto/);
  assert.match(html, /\.portfolio-pages\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*gap:\s*24px/);
  assert.match(html, /\.portfolio-page\s*\{[^}]*width:\s*min\(100%,\s*1200px\)/);
  assert.doesNotMatch(html, /<form\b|type="password"|type="email"/i);
});

test("instruments every public viewer route with the configured Microsoft Clarity project", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-clarity-viewer-test-"));
  const manifestPath = join(directory, "manifest.json");
  const outputDirectory = join(directory, "site");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(manifestPath, JSON.stringify({
    ...manifest,
    routes: [
      ...manifest.routes,
      { path: "/globex", companyKey: "globex", versionId: "portfolio-v1" }
    ]
  }));

  await buildViewer({ manifestPath, outputDirectory, clarityProjectId: "abcd1234" });

  for (const route of ["acme", "globex"]) {
    const html = await readFile(join(outputDirectory, route, "index.html"), "utf8");
    assert.match(html, /https:\/\/www\.clarity\.ms\/tag\/"\+i/);
    assert.match(html, /\)\(window, document, "clarity", "script", "abcd1234"\);/);
  }
});

test("does not add a Clarity script when no project ID is configured", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-clarity-local-test-"));
  const manifestPath = join(directory, "manifest.json");
  const outputDirectory = join(directory, "site");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(manifestPath, JSON.stringify(manifest));

  await buildViewer({ manifestPath, outputDirectory });

  const html = await readFile(join(outputDirectory, "acme", "index.html"), "utf8");
  assert.doesNotMatch(html, /clarity\.ms|window\.clarity|fake.*clarity/i);
});
