import { access, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// The source PDF uses points as its 1920×1080 canvas. Rendering at 72 DPI
// keeps that canvas at 1920×1080 pixels and avoids an unnecessarily heavy
// first-page download for the desktop validation target.
const DEFAULT_DPI = 72;

function fail(message) {
  throw new Error(`PDF conversion failed: ${message}`);
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

function parsePageCount(info) {
  const match = info.match(/^Pages:\s+(\d+)$/m);
  if (!match || Number(match[1]) < 1) fail("the input PDF has no readable pages");
  return Number(match[1]);
}

function parsePageSize(info, ordinal) {
  const match = info.match(/^Page\s+\d+\s+size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m);
  if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0) {
    fail(`could not determine dimensions for PDF page ${ordinal}`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

export async function readPngDimensions(path) {
  const image = await readFile(path);
  if (image.length < 24 || !image.subarray(0, 8).equals(PNG_SIGNATURE) || image.toString("ascii", 12, 16) !== "IHDR") {
    fail(`${path} is not a readable PNG`);
  }
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (width === 0 || height === 0) fail(`${path} has invalid dimensions`);
  return { width, height };
}

function hasMatchingAspectRatio(image, pdf) {
  const imageRatio = image.width / image.height;
  const pdfRatio = pdf.width / pdf.height;
  return Math.abs(imageRatio - pdfRatio) / pdfRatio <= 0.001;
}

async function assertNewDirectory(path) {
  try {
    await access(path);
    fail(`output directory already exists: ${path}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function pageFileName(ordinal, pageCount) {
  return `${String(ordinal).padStart(Math.max(3, String(pageCount).length), "0")}.png`;
}

/**
 * Renders every source-PDF page into a new PNG directory. The final directory
 * is created only after the exact ordered page set has been verified.
 */
export async function convertPdf({ inputPath, outputDirectory, dpi = DEFAULT_DPI }) {
  const input = resolve(inputPath);
  const output = resolve(outputDirectory);
  const repositoryRelativeOutput = relative(process.cwd(), output).split("\\").join("/");
  if (!Number.isInteger(dpi) || dpi < 1) fail("dpi must be a positive integer");
  if (extname(input).toLowerCase() !== ".pdf") fail("input path must have a .pdf extension");
  if (!repositoryRelativeOutput.startsWith("assets/versions/") || !repositoryRelativeOutput.endsWith("/pages")) {
    fail("output directory must be an assets/versions/<version>/pages repository path");
  }

  const inputStats = await stat(input).catch(() => fail(`input PDF does not exist: ${input}`));
  if (!inputStats.isFile()) fail(`input PDF is not a file: ${input}`);
  const header = await readFile(input).catch(() => fail(`cannot read input PDF: ${input}`));
  if (!header.subarray(0, 5).equals(Buffer.from("%PDF-"))) fail("input is not a PDF file");

  await assertNewDirectory(output);
  const documentInfo = await run("pdfinfo", [input]);
  const pageCount = parsePageCount(documentInfo);
  const outputParent = dirname(output);
  const temporary = resolve(outputParent, `.${basename(output)}.rendering-${process.pid}-${Date.now()}`);
  await mkdir(outputParent, { recursive: true });
  await assertNewDirectory(temporary);
  await mkdir(temporary);

  try {
    const pages = [];
    for (let ordinal = 1; ordinal <= pageCount; ordinal += 1) {
      const pageSize = parsePageSize(await run("pdfinfo", ["-f", String(ordinal), "-l", String(ordinal), input]), ordinal);
      const stem = basename(pageFileName(ordinal, pageCount), ".png");
      await run("pdftoppm", [
        "-f", String(ordinal), "-l", String(ordinal), "-singlefile", "-png", "-r", String(dpi), input, resolve(temporary, stem)
      ]);
      const file = resolve(temporary, pageFileName(ordinal, pageCount));
      const dimensions = await readPngDimensions(file);
      if (!hasMatchingAspectRatio(dimensions, pageSize)) {
        fail(`rendered page ${ordinal} does not preserve the PDF aspect ratio`);
      }
      pages.push({
        ordinal,
        assetPath: `${repositoryRelativeOutput}/${pageFileName(ordinal, pageCount)}`,
        ...dimensions
      });
    }

    const expectedFiles = new Set(pages.map((page) => basename(page.assetPath)));
    const actualFiles = await readdir(temporary);
    if (actualFiles.length !== expectedFiles.size || actualFiles.some((file) => !expectedFiles.has(file))) {
      fail("the rendered page set is incomplete or contains unexpected files");
    }
    await rename(temporary, output);
    return pages;
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) fail("usage: --input <pdf> --output <directory> [--dpi <integer>]");
    values[key.slice(2)] = value;
  }
  if (!values.input || !values.output || Object.keys(values).some((key) => !["input", "output", "dpi"].includes(key))) {
    fail("usage: --input <pdf> --output <directory> [--dpi <integer>]");
  }
  return { inputPath: values.input, outputDirectory: values.output, dpi: values.dpi === undefined ? DEFAULT_DPI : Number(values.dpi) };
}

async function main() {
  const pages = await convertPdf(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({ pages }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
