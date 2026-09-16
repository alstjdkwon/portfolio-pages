import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { preparePublishedAssets } from "../scripts/prepare-published-assets.mjs";

function createPdf(width, height) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R >>`,
    "<< /Length 0 >>\nstream\n\nendstream"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  return `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

test("converts a declared PDF with no page directory before it can enter a Pages artifact", async (t) => {
  const versionId = "action-conversion-test";
  const assetDirectory = join(process.cwd(), "assets", "versions", versionId);
  const directory = await mkdtemp(join(tmpdir(), "portfolio-prepare-assets-test-"));
  const manifestPath = join(directory, "manifest.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.after(() => rm(assetDirectory, { recursive: true, force: true }));
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(join(assetDirectory, "source.pdf"), createPdf(200, 100));
  await writeFile(manifestPath, JSON.stringify({
    schema: "portfolio-manifest/v1",
    bootstrap: { fixedPdfFingerprint: "a".repeat(64), verificationStatus: "passed" },
    automation: { repeatingPublishEnabled: true },
    versions: [{
      id: versionId,
      sourcePdfPath: `assets/versions/${versionId}/source.pdf`,
      sourceRef: "b".repeat(40),
      pages: [{ ordinal: 1, assetPath: `assets/versions/${versionId}/pages/001.png`, width: 200, height: 100 }]
    }],
    routes: [{ path: "/action-conversion", companyKey: "action-conversion", versionId }]
  }));

  await preparePublishedAssets({ manifestPath, dpi: 72 });

  assert.ok((await readFile(join(assetDirectory, "pages", "001.png"))).length > 24);
});
