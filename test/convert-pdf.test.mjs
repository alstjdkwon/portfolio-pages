import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { convertPdf, readPngDimensions } from "../scripts/convert-pdf.mjs";

function createPdf(pageSizes) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageSizes.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pageSizes.length} >>`
  ];
  for (const [index, { width, height }] of pageSizes.entries()) {
    const pageObject = 3 + index * 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents ${pageObject + 1} 0 R >>`);
    objects.push("<< /Length 0 >>\nstream\n\nendstream");
  }
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

test("converts every PDF page in ordinal order while preserving each aspect ratio", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-pdf-test-"));
  await mkdir(join(process.cwd(), "assets", "versions"), { recursive: true });
  const versionDirectory = await mkdtemp(join(process.cwd(), "assets", "versions", "converter-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.after(() => rm(versionDirectory, { recursive: true, force: true }));
  const source = join(directory, "source.pdf");
  const output = join(versionDirectory, "pages");
  await writeFile(source, createPdf([{ width: 200, height: 100 }, { width: 100, height: 200 }]));

  const pages = await convertPdf({ inputPath: source, outputDirectory: output });

  assert.deepEqual(pages.map(({ ordinal, assetPath, width, height }) => ({ ordinal, assetPath: assetPath.split("/").at(-1), width, height })), [
    { ordinal: 1, assetPath: "001.png", width: 200, height: 100 },
    { ordinal: 2, assetPath: "002.png", width: 100, height: 200 }
  ]);
  assert.deepEqual(await readPngDimensions(join(output, "002.png")), { width: 100, height: 200 });
});

test("does not publish a partial image set when conversion fails", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-pdf-test-"));
  await mkdir(join(process.cwd(), "assets", "versions"), { recursive: true });
  const versionDirectory = await mkdtemp(join(process.cwd(), "assets", "versions", "converter-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.after(() => rm(versionDirectory, { recursive: true, force: true }));
  const source = join(directory, "invalid.pdf");
  const output = join(versionDirectory, "pages");
  await writeFile(source, "%PDF-not-a-valid-document");

  await assert.rejects(convertPdf({ inputPath: source, outputDirectory: output }), /PDF conversion failed|pdfinfo/);
  await assert.rejects(readFile(output), { code: "ENOENT" });
});
