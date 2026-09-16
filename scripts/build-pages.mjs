import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildViewer } from "./build-viewer.mjs";
import { validatePublishedAssets } from "./validate-published-assets.mjs";

/**
 * Creates the complete, self-contained GitHub Pages artifact in a fresh
 * directory. The caller uploads it only after this function succeeds.
 */
export async function buildPages({ manifestPath = "portfolio/manifest.json", outputDirectory, clarityProjectId = process.env.CLARITY_PROJECT_ID } = {}) {
  if (!outputDirectory) throw new Error("outputDirectory is required");
  const output = resolve(outputDirectory);
  await validatePublishedAssets({ manifestPath });
  await mkdir(output, { recursive: true });
  await cp(resolve("assets"), resolve(output, "assets"), { recursive: true });
  await buildViewer({ manifestPath, outputDirectory: output, clarityProjectId });
  await writeFile(resolve(output, ".nojekyll"), "");
}

async function main() {
  const args = process.argv.slice(2);
  const outputFlag = args.indexOf("--output");
  const manifestFlag = args.indexOf("--manifest");
  if (outputFlag === -1 || !args[outputFlag + 1] || args.length !== (manifestFlag === -1 ? 2 : 4)) {
    throw new Error("usage: --output <directory> [--manifest <path>]");
  }
  await buildPages({ outputDirectory: args[outputFlag + 1], manifestPath: manifestFlag === -1 ? undefined : args[manifestFlag + 1] });
  console.log("GitHub Pages artifact built.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
