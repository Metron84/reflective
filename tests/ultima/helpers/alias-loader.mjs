// Resolves the "@/..." import alias the way jsconfig does, for node:test.
import { statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = new URL("../../../", import.meta.url);

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = fileURLToPath(new URL(specifier.slice(2), ROOT));
    for (const candidate of [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`]) {
      if (isFile(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  // Node's ESM resolver wants the extension on Next's subpath exports.
  if (/^next\/[a-z-]+$/.test(specifier)) {
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
}
