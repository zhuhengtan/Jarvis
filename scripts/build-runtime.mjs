#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

const entries = {
  server: join(root, "apps/server/src/main.ts"),
  "mcp-http": join(root, "apps/mcp/src/http.ts"),
  "mcp-stdio": join(root, "apps/mcp/src/stdio.ts"),
  worker: join(root, "apps/worker/src/main.ts"),
  cli: join(root, "apps/cli/src/main.ts"),
};

await esbuild.build({
  absWorkingDir: root,
  entryPoints: entries,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outdir: dist,
  sourcemap: true,
  logLevel: "info",
  plugins: [{
    name: "external-non-workspace",
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.path.startsWith("@jarvis/")) return null;
        return { path: args.path, external: true };
      });
    },
  }],
});

console.log(`Jarvis runtime written to ${dist}`);
