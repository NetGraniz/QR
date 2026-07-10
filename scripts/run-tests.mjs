import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, "work", "test-build");
const sourceRoots = ["src", "tests"];

fs.rmSync(outDir, { recursive: true, force: true });

function listTsFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...listTsFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      result.push(absolute);
    }
  }
  return result;
}

function rewriteImports(code) {
  return code.replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (match, prefix, specifier, suffix) => {
    if (specifier.endsWith(".js")) {
      return match;
    }
    return `${prefix}${specifier}.js${suffix}`;
  });
}

for (const sourceRoot of sourceRoots) {
  const absoluteRoot = path.join(root, sourceRoot);
  if (!fs.existsSync(absoluteRoot)) continue;

  for (const file of listTsFiles(absoluteRoot)) {
    const relative = path.relative(root, file).replace(/\.ts$/, ".js");
    const target = path.join(outDir, relative);
    const source = fs.readFileSync(file, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ES2020,
        esModuleInterop: true,
      },
    });

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, rewriteImports(transpiled.outputText));
  }
}

const result = spawnSync(process.execPath, ["--test", path.join(outDir, "tests", "run-tests.js")], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
