import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const distRoot = path.join(root, "dist");

async function copyDir(relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(distRoot, relativePath);
  await fs.mkdir(target, { recursive: true });
  await fs.cp(source, target, { recursive: true });
}

await copyDir("views");
await copyDir("public");
