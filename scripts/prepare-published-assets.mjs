import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { convertPdf } from "./convert-pdf.mjs";
import { assertManifest } from "./validate-manifest.mjs";

function fail(message) {
  throw new Error(`PDF publication preparation failed: ${message}`);
}

async function directoryExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function matchesManifest(renderedPages, version) {
  return renderedPages.length === version.pages.length && renderedPages.every((page, index) => {
    const expected = version.pages[index];
    return page.ordinal === expected.ordinal && page.assetPath === expected.assetPath &&
      page.width === expected.width && page.height === expected.height;
  });
}

/**
 * Converts only a version with no committed page directory. Existing output is
 * immutable: it is validated later instead of being overwritten. Generated
 * pages live only in the Actions workspace until a complete Pages artifact is
 * uploaded.
 */
export async function preparePublishedAssets({ manifestPath = "portfolio/manifest.json", dpi } = {}) {
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  assertManifest(manifest);

  for (const version of manifest.versions) {
    const outputDirectory = resolve(dirname(version.pages[0].assetPath));
    if (await directoryExists(outputDirectory)) continue;
    const renderedPages = await convertPdf({
      inputPath: version.sourcePdfPath,
      outputDirectory,
      ...(dpi === undefined ? {} : { dpi })
    });
    if (!matchesManifest(renderedPages, version)) {
      fail(`converted pages for ${version.id} do not match the declared manifest`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const manifestFlag = args.indexOf("--manifest");
  if (args.length !== 0 && (args.length !== 2 || manifestFlag !== 0 || !args[1])) {
    throw new Error("usage: [--manifest <path>]");
  }
  await preparePublishedAssets({ manifestPath: manifestFlag === -1 ? undefined : args[1] });
  console.log("Declared PDF conversion output prepared.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
