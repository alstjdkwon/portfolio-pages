import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readPngDimensions } from "./convert-pdf.mjs";
import { assertManifest } from "./validate-manifest.mjs";

function fail(message) {
  throw new Error(`Published asset validation failed: ${message}`);
}

async function assertPdf(path) {
  const source = await readFile(path).catch(() => fail(`source PDF is missing: ${path}`));
  if (!source.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    fail(`source PDF is not readable: ${path}`);
  }
}

/**
 * Ensures that a manifest only references complete, committed conversion output.
 * GitHub Pages is never assembled from missing or mismatched page assets.
 */
export async function validatePublishedAssets({ manifestPath = "portfolio/manifest.json" } = {}) {
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  assertManifest(manifest);

  for (const version of manifest.versions) {
    await assertPdf(resolve(version.sourcePdfPath));
    for (const page of version.pages) {
      const assetPath = resolve(page.assetPath);
      await access(assetPath).catch(() => fail(`rendered page is missing: ${page.assetPath}`));
      const dimensions = await readPngDimensions(assetPath);
      if (dimensions.width !== page.width || dimensions.height !== page.height) {
        fail(`rendered page ${page.assetPath} does not match manifest dimensions`);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 0 && (args.length !== 2 || args[0] !== "--manifest")) {
    throw new Error("usage: [--manifest <path>]");
  }
  await validatePublishedAssets({ manifestPath: args[1] });
  console.log("Published PDF assets valid.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
