import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildPages } from "../scripts/build-pages.mjs";
import { validatePublishedAssets } from "../scripts/validate-published-assets.mjs";

const versionId = "workflow-asset-test";
const assetDirectory = join(process.cwd(), "assets", "versions", versionId);
const manifest = {
  schema: "portfolio-manifest/v1",
  bootstrap: { fixedPdfFingerprint: "a".repeat(64), verificationStatus: "passed" },
  automation: { repeatingPublishEnabled: true },
  versions: [{
    id: versionId,
    sourcePdfPath: `assets/versions/${versionId}/source.pdf`,
    sourceRef: "b".repeat(40),
    pages: [{ ordinal: 1, assetPath: `assets/versions/${versionId}/pages/001.png`, width: 200, height: 100 }]
  }],
  routes: [{ path: "/workflow-check", companyKey: "workflow-check", versionId }]
};

function png(width, height) {
  const data = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data);
  data.write("IHDR", 12, "ascii");
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}

test("validates every committed PDF source and rendered page before publishing", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-publish-assets-test-"));
  const manifestPath = join(directory, "manifest.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.after(() => rm(assetDirectory, { recursive: true, force: true }));
  await mkdir(join(assetDirectory, "pages"), { recursive: true });
  await writeFile(join(assetDirectory, "source.pdf"), "%PDF-1.4");
  await writeFile(join(assetDirectory, "pages", "001.png"), png(200, 100));
  await writeFile(manifestPath, JSON.stringify(manifest));

  await assert.doesNotReject(validatePublishedAssets({ manifestPath }));
  await writeFile(join(assetDirectory, "pages", "001.png"), png(201, 100));
  await assert.rejects(validatePublishedAssets({ manifestPath }), /does not match manifest dimensions/);
});

test("stages validated assets and generated route documents as one Pages artifact", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-pages-build-test-"));
  const manifestPath = join(directory, "manifest.json");
  const outputDirectory = join(directory, "site");
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.after(() => rm(assetDirectory, { recursive: true, force: true }));
  await mkdir(join(assetDirectory, "pages"), { recursive: true });
  await writeFile(join(assetDirectory, "source.pdf"), "%PDF-1.4");
  await writeFile(join(assetDirectory, "pages", "001.png"), png(200, 100));
  await writeFile(manifestPath, JSON.stringify(manifest));

  await buildPages({ manifestPath, outputDirectory });

  assert.match(await readFile(join(outputDirectory, "workflow-check", "index.html"), "utf8"), /001\.png/);
  assert.deepEqual(await readFile(join(outputDirectory, "assets", "versions", versionId, "pages", "001.png")), png(200, 100));
});
