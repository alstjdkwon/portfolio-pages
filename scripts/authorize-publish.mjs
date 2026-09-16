import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { assertManifest } from "./validate-manifest.mjs";

const mode = process.env.PUBLISH_MODE;
const actor = process.env.PUBLISH_ACTOR;
const owner = process.env.PORTFOLIO_OWNER_LOGIN;

if (!owner || !actor || actor !== owner) {
  throw new Error("Publishing is restricted to the configured repository owner.");
}
if (mode !== "bootstrap" && mode !== "repeat") {
  throw new Error("PUBLISH_MODE must be bootstrap or repeat.");
}

const manifest = JSON.parse(await readFile("portfolio/manifest.json", "utf8"));
assertManifest(manifest);

if (mode === "repeat" && !manifest.automation.repeatingPublishEnabled) {
  throw new Error("Repeating publishing is disabled until bootstrap verification passes.");
}
if (mode === "bootstrap") {
  const pdfPath = process.env.BOOTSTRAP_PDF;
  if (!pdfPath) throw new Error("BOOTSTRAP_PDF is required for bootstrap publishing.");
  const fingerprint = createHash("sha256").update(await readFile(pdfPath)).digest("hex");
  if (fingerprint !== manifest.bootstrap.fixedPdfFingerprint) {
    throw new Error("Bootstrap publishing accepts only the fixed verification PDF.");
  }
}

console.log(`${mode} publishing authorized for ${actor}.`);
