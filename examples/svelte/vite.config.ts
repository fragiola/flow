// examples/vue/vite.config.ts for the Svelte app.

import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { examplesApp } from "examples-shared/scripts/examples-lib";
import { buildManifest } from "examples-shared/scripts/manifest";
import { defineConfig, type Plugin } from "vite";
import { examplesResolve, prePaintTheme } from "./vite.shared.ts";

// The Svelte embed app of the site export (contract v1.7, §5): `?id=<id>&theme=<name>` renders one
// example on the whole viewport, with no chrome. It is built for `<base>/embed/svelte/`
// (`EMBED_BASE`, set by site/export.ts) into `EMBED_OUT_DIR` (default `dist`).

const base = process.env.EMBED_BASE ?? "/";
const outDir = process.env.EMBED_OUT_DIR;

/**
 * In dev, `<base>manifest.json` is served too, built per request (the site in dev reads it through
 * its proxy); the files are read fresh, a metadata change (examples/shared/src/meta) needs a
 * restart. The build's manifest is
 * written by site/export.ts.
 */
function devManifest(): Plugin {
    return {
        name: "dev-manifest",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url?.split("?")[0] !== `${base}manifest.json`) {
                    return next();
                }
                res.setHeader("Content-Type", "application/json");
                res.end(
                    JSON.stringify(await buildManifest(examplesApp("svelte"))),
                );
            });
        },
    };
}

export default defineConfig(({ command }) => ({
    base,
    plugins: [svelte(), tailwindcss(), prePaintTheme(), devManifest()],
    resolve: examplesResolve(command),
    build: outDir ? { outDir, emptyOutDir: true } : {},
    // 5187: React's embed has 5185 (Flow's dev port, www's `devUrl`, the site:dev proxy), Vue's
    // 5186; PORT moves it
    server: { port: Number(process.env.PORT ?? 5187), strictPort: true },
}));
