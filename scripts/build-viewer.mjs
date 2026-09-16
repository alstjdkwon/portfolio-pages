import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, posix, resolve } from "node:path";
import { assertManifest } from "./validate-manifest.mjs";

const styles = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f4f4; }
  .portfolio-pages { display: flex; flex-direction: column; align-items: center; gap: 24px; }
  .portfolio-page { width: min(100%, 1200px); flex: none; }
  .portfolio-page img { display: block; width: 100%; height: auto; }
`;

function claritySnippet(projectId) {
  if (!projectId) return "";
  if (typeof projectId !== "string" || !/^[A-Za-z0-9_-]+$/.test(projectId)) {
    throw new Error("CLARITY_PROJECT_ID must contain only letters, numbers, hyphens, or underscores");
  }

  return `
  <script>
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${projectId}");
  </script>`;
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function pageImage(page, publicRoute) {
  const source = posix.relative(publicRoute.slice(1), page.assetPath);
  return `<article class="portfolio-page"><img src="${escapeAttribute(source)}" width="${page.width}" height="${page.height}" alt="Portfolio page ${page.ordinal}"${page.ordinal === 1 ? ' fetchpriority="high"' : ' loading="lazy"'}></article>`;
}

function viewerDocument(pages, publicRoute, clarityProjectId) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Portfolio</title>
  <style>${styles}</style>${claritySnippet(clarityProjectId)}
</head>
<body>
  <main class="portfolio-pages" aria-label="Portfolio pages">
    ${pages.map((page) => pageImage(page, publicRoute)).join("\n    ")}
  </main>
</body>
</html>
`;
}

/**
 * Creates static GitHub Pages documents for every manifest route. Each image
 * uses its rendered dimensions so the browser reserves its final layout before
 * the image is available.
 */
export async function buildViewer({ manifestPath = "portfolio/manifest.json", outputDirectory, clarityProjectId } = {}) {
  if (!outputDirectory) throw new Error("outputDirectory is required");
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  assertManifest(manifest);
  const versions = new Map(manifest.versions.map((version) => [version.id, version]));
  const output = resolve(outputDirectory);

  for (const route of manifest.routes) {
    const routeDirectory = resolve(output, route.path.slice(1));
    const pagePath = resolve(routeDirectory, "index.html");
    await mkdir(dirname(pagePath), { recursive: true });
    await writeFile(pagePath, viewerDocument(versions.get(route.versionId).pages, route.path, clarityProjectId));
  }
}
