import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const workflowPath = resolve(".github/workflows/publish-pages.yml");

async function workflow() {
  return readFile(workflowPath, "utf8");
}

test("offers one workflow for bootstrap and repeat publishing", async () => {
  const yaml = await workflow();

  assert.match(yaml, /workflow_dispatch:/);
  assert.match(yaml, /publish_mode:/);
  assert.match(yaml, /- bootstrap/);
  assert.match(yaml, /- repeat/);
  assert.match(yaml, /uses: \.\/\.github\/workflows\/authorize-publish\.yml/);
  assert.match(yaml, /CLARITY_PROJECT_ID/);
  assert.match(yaml, /"docs\/\*\*"/);
});

test("publishes Pages only after conversion validation and site assembly", async () => {
  const yaml = await workflow();
  const buildJob = yaml.indexOf("  build:");
  const deployJob = yaml.indexOf("  deploy:");

  assert.ok(buildJob >= 0, "the build job is present");
  assert.ok(deployJob > buildJob, "the deploy job follows the build job");
  assert.match(yaml.slice(buildJob, deployJob), /node scripts\/validate-manifest\.mjs/);
  assert.match(yaml.slice(buildJob, deployJob), /git cat-file -e "HEAD\^:portfolio\/manifest\.json"/);
  assert.match(yaml.slice(buildJob, deployJob), /--previous \/tmp\/previous-manifest\.json/);
  assert.match(yaml.slice(buildJob, deployJob), /poppler-utils/);
  assert.match(yaml.slice(buildJob, deployJob), /node scripts\/prepare-published-assets\.mjs/);
  assert.match(yaml.slice(buildJob, deployJob), /node scripts\/validate-published-assets\.mjs/);
  assert.match(yaml.slice(buildJob, deployJob), /node scripts\/build-pages\.mjs/);
  assert.match(yaml.slice(deployJob), /needs: \[build\]/);
  assert.match(yaml.slice(deployJob), /actions\/deploy-pages@v4/);
});

test("reports processing, success, and failure without exposing a failed run URL", async () => {
  const yaml = await workflow();
  const failureJob = yaml.indexOf("  report-failure:");

  assert.match(yaml, /## processing/);
  assert.match(yaml, /## published/);
  assert.ok(failureJob >= 0, "the failure reporting job is present");
  assert.match(yaml.slice(failureJob), /always\(\)/);
  assert.match(yaml.slice(failureJob), /## failed/);
  assert.match(yaml.slice(failureJob), /Existing GitHub Pages content remains published\./);
  assert.doesNotMatch(yaml.slice(failureJob), /page_url/);
});
