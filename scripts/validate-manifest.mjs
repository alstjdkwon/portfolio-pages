import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const VERSION_ID = /^[a-z0-9][a-z0-9-]*$/;
const PUBLIC_PATH = /^\/[a-z0-9][a-z0-9-]*$/;
const SOURCE_PDF_PATH = /^(?:assets\/versions\/|docs\/)[^/].*\.pdf$/i;
const VERIFICATION_STATUSES = new Set(["not_started", "failed", "passed"]);

function fail(message) {
  throw new Error(`Invalid portfolio manifest: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertManifest(manifest) {
  if (!isRecord(manifest) || manifest.schema !== "portfolio-manifest/v1") {
    fail("schema must be portfolio-manifest/v1");
  }
  if (!isRecord(manifest.bootstrap) || !SHA256.test(manifest.bootstrap.fixedPdfFingerprint)) {
    fail("bootstrap.fixedPdfFingerprint must be a SHA-256 digest");
  }
  if (!VERIFICATION_STATUSES.has(manifest.bootstrap.verificationStatus)) {
    fail("bootstrap.verificationStatus is invalid");
  }
  if (!isRecord(manifest.automation) || typeof manifest.automation.repeatingPublishEnabled !== "boolean") {
    fail("automation.repeatingPublishEnabled must be boolean");
  }
  if (manifest.automation.repeatingPublishEnabled && manifest.bootstrap.verificationStatus !== "passed") {
    fail("repeating publishing requires passed bootstrap verification");
  }
  if (!Array.isArray(manifest.versions) || !Array.isArray(manifest.routes)) {
    fail("versions and routes must be arrays");
  }

  const versionIds = new Set();
  for (const version of manifest.versions) {
    if (!isRecord(version) || !VERSION_ID.test(version.id) || versionIds.has(version.id)) {
      fail("each version needs a unique lowercase id");
    }
    if (typeof version.sourcePdfPath !== "string" || !SOURCE_PDF_PATH.test(version.sourcePdfPath)) {
      fail(`version ${version.id} needs an immutable sourcePdfPath`);
    }
    if (!GIT_SHA.test(version.sourceRef)) {
      fail(`version ${version.id} needs a 40-character immutable sourceRef`);
    }
    if (!Array.isArray(version.pages) || version.pages.length === 0) {
      fail(`version ${version.id} needs every rendered page`);
    }
    version.pages.forEach((page, index) => {
      if (!isRecord(page) || page.ordinal !== index + 1 || typeof page.assetPath !== "string" ||
        !page.assetPath.startsWith(`assets/versions/${version.id}/pages/`) ||
        !Number.isFinite(page.width) || page.width <= 0 || !Number.isFinite(page.height) || page.height <= 0) {
        fail(`version ${version.id} page ${index + 1} is incomplete or out of order`);
      }
    });
    versionIds.add(version.id);
  }

  const routePaths = new Set();
  for (const route of manifest.routes) {
    if (!isRecord(route) || !PUBLIC_PATH.test(route.path) || routePaths.has(route.path)) {
      fail("each route needs a unique absolute lowercase path");
    }
    if (typeof route.companyKey !== "string" || route.companyKey.length === 0 || !versionIds.has(route.versionId)) {
      fail(`route ${route.path} must reference an existing version`);
    }
    routePaths.add(route.path);
  }
}

export function assertAppendOnly(previous, current) {
  for (const previousVersion of previous.versions) {
    const version = current.versions.find(({ id }) => id === previousVersion.id);
    if (!version || JSON.stringify(version) !== JSON.stringify(previousVersion)) {
      fail(`published version ${previousVersion.id} must remain unchanged`);
    }
  }
  for (const previousRoute of previous.routes) {
    const route = current.routes.find(({ path }) => path === previousRoute.path);
    if (!route || JSON.stringify(route) !== JSON.stringify(previousRoute)) {
      fail(`published route ${previousRoute.path} must remain unchanged`);
    }
  }
}

async function loadJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function main() {
  const args = process.argv.slice(2);
  const manifestFlag = args.indexOf("--manifest");
  const previousFlag = args.indexOf("--previous");
  const manifestPath = manifestFlag === -1 ? "portfolio/manifest.json" : args[manifestFlag + 1];
  const manifest = await loadJson(manifestPath);
  assertManifest(manifest);
  if (previousFlag !== -1) {
    const previous = await loadJson(args[previousFlag + 1]);
    assertManifest(previous);
    assertAppendOnly(previous, manifest);
  }
  console.log(`Manifest valid: ${manifest.versions.length} version(s), ${manifest.routes.length} route(s).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
