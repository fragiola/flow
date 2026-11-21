// From Splitter (fragiola/splitter, packages/core/tests/guard.test.ts), same author and licence.
// The core's non-negotiable rules (AGENTS.md, D14), each one a test: no framework import, zero
// runtime dependencies, no global DOM or crypto, nothing only Node has, no `any` in the exported
// declarations, no CSS, and no ported code (nothing is copied from xyflow, Provenance).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const src = join(root, "src");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

/** Source text with comments and string literals blanked out, so only code is scanned. */
function codeOnly(source: string): string {
    return source.replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g,
        (match) => (match.startsWith("/") ? "" : '""'),
    );
}

/** The files of src/ whose code matches `pattern`, with what matched. */
function offendersOf(pattern: RegExp, scan = codeOnly): string[] {
    return listFiles(src).flatMap((file) => {
        const match = pattern.exec(scan(readFileSync(file, "utf8")));
        return match ? [`${file.slice(root.length + 1)}: ${match[0]}`] : [];
    });
}

const keep = (source: string) => source;

/** The one file that writes a style: the viewport's transform (D4). */
const STRUCTURAL_STYLE = "src/engine/structural-style.ts";

// the core never reaches for the browser globals: DOM access goes through an element's
// ownerDocument/defaultView, so it runs inside an iframe or a popup, and loads in Node
const GLOBAL_DOM =
    /(?<![.\w$])(document|window|requestAnimationFrame|cancelAnimationFrame|ResizeObserver|getComputedStyle|navigator|localStorage|sessionStorage|matchMedia)\b(?!\s*\??:)/;
const GLOBAL_CRYPTO = /(?<![.\w$])crypto\b(?!\s*\??:)/;

/** Node's own modules and globals: the core runs in a browser too. */
const NODE_ONLY =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?:node:[^"']+|fs|path|os|process)["']|(?<![.\w$])(?:process|Buffer|__dirname)\b(?!\s*\??:)/;

const IMPORT_FRAMEWORK =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?:react|react-dom|vue|@vue\/[^"']+|@angular\/[^"']+|svelte|solid-js|preact|@xyflow\/[^"']+|reactflow)(?:\/[^"']*)?["']/;

/** Any import that is not a relative path: the core has no runtime dependency. */
const PACKAGE_IMPORT =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?!\.)[^"']+["']/;

/** A header that names an upstream origin: a port, which this repository never has. */
const PORTED_HEADER =
    /xyflow|reactflow|react-flow|svelte-flow|webkid|Copyright \(c\)/i;

/** A file's leading line comments, joined into one sentence. */
function headOf(file: string): string {
    return (
        /^(?:\/\/[^\n]*\n)+/.exec(readFileSync(file, "utf8"))?.[0] ?? ""
    ).replace(/\s*\n\/\/\s*|\s+/g, " ");
}

/** The exported declarations of a source (comments and strings already blanked). */
function exportedDeclarations(source: string): string[] {
    const declarations: string[] = [];
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (!line.startsWith("export ")) {
            continue;
        }
        const block = [line];
        if (!/;\s*$/.test(line) && !/^export \{.*\}.*;?$/.test(line)) {
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j] ?? "";
                block.push(next);
                if (/^[}\]);]/.test(next)) {
                    break;
                }
            }
        }
        declarations.push(block.join("\n"));
    }
    return declarations;
}

describe("core package guard", () => {
    it("has no runtime or peer dependencies", () => {
        const pkg = JSON.parse(
            readFileSync(join(root, "package.json"), "utf8"),
        ) as Record<string, unknown>;
        expect(pkg.dependencies ?? {}).toEqual({});
        expect(pkg.peerDependencies ?? {}).toEqual({});
        expect(pkg.optionalDependencies ?? {}).toEqual({});
    });

    it("imports nothing but its own modules", () => {
        expect(offendersOf(PACKAGE_IMPORT, keep)).toEqual([]);
        expect(PACKAGE_IMPORT.test('import { x } from "./x";')).toBe(false);
        expect(PACKAGE_IMPORT.test('import { x } from "lodash";')).toBe(true);
        expect(PACKAGE_IMPORT.test('export * from "@xyflow/system";')).toBe(
            true,
        );
    });

    it("never imports a framework (React, Vue, Svelte, Angular, …) nor xyflow", () => {
        expect(offendersOf(IMPORT_FRAMEWORK, keep)).toEqual([]);
        for (const source of [
            'import type * as React from "react";',
            'import { createPortal } from "react-dom/client";',
            'import { h } from "vue";',
            'import { onMount } from "svelte";',
            'import { writable } from "svelte/store";',
            'import { Component } from "@angular/core";',
            'import { getBezierPath } from "@xyflow/system";',
        ]) {
            expect(IMPORT_FRAMEWORK.test(source), source).toBe(true);
        }
        expect(IMPORT_FRAMEWORK.test('import { x } from "./reactive";')).toBe(
            false,
        );
    });

    it("never touches global document, window, ResizeObserver or frame scheduling", () => {
        expect(offendersOf(GLOBAL_DOM)).toEqual([]);
        expect(
            GLOBAL_DOM.test(codeOnly("document.createElement('div');")),
        ).toBe(true);
        expect(GLOBAL_DOM.test(codeOnly("window.addEventListener(x);"))).toBe(
            true,
        );
        expect(
            GLOBAL_DOM.test(codeOnly("requestAnimationFrame(() => {});")),
        ).toBe(true);
        expect(GLOBAL_DOM.test(codeOnly("new ResizeObserver(cb);"))).toBe(true);
        expect(
            GLOBAL_DOM.test(
                codeOnly("el.ownerDocument.defaultView.ResizeObserver"),
            ),
        ).toBe(false);
        expect(GLOBAL_DOM.test(codeOnly("// the window\nconst x = 1;"))).toBe(
            false,
        );
        expect(GLOBAL_DOM.test(codeOnly("function f(window: Window) {}"))).toBe(
            false,
        );
    });

    it("never reaches for the global crypto (ids come from an injectable createId)", () => {
        expect(offendersOf(GLOBAL_CRYPTO)).toEqual([]);
        expect(GLOBAL_CRYPTO.test(codeOnly("crypto.randomUUID()"))).toBe(true);
        expect(GLOBAL_CRYPTO.test(codeOnly("view.crypto.randomUUID()"))).toBe(
            false,
        );
    });

    it("uses nothing only Node has", () => {
        expect(offendersOf(NODE_ONLY)).toEqual([]);
        expect(NODE_ONLY.test('import { readFileSync } from "node:fs";')).toBe(
            true,
        );
        expect(NODE_ONLY.test(codeOnly("process.env.X"))).toBe(true);
    });

    it("has no `any` in its exported declarations", () => {
        const offenders = listFiles(src).flatMap((file) =>
            exportedDeclarations(codeOnly(readFileSync(file, "utf8")))
                .filter((declaration) => /\bany\b/.test(declaration))
                .map((declaration) => `${file}: ${declaration.slice(0, 80)}`),
        );
        expect(offenders).toEqual([]);
        expect(
            exportedDeclarations("export type X = any;\nconst y: any = 1;"),
        ).toEqual(["export type X = any;"]);
    });

    it("has no CSS class names and writes no cursor or style", () => {
        expect(offendersOf(/\b(className|classList|cursor)/)).toEqual([]);
        // the viewport's transform is the one structural style the engine writes (D4), in one file
        expect(
            offendersOf(/\.style\b/).filter(
                (offender) => !offender.startsWith(STRUCTURAL_STYLE),
            ),
        ).toEqual([]);
        const writes = [
            ...codeOnly(
                readFileSync(join(root, STRUCTURAL_STYLE), "utf8"),
            ).matchAll(/\.style\.(\w+)/g),
        ].map(([, property]) => property);
        expect(new Set(writes)).toEqual(
            new Set(["transformOrigin", "transform", "removeProperty"]),
        );
    });

    it("has no ported code: no file names an upstream origin (Provenance)", () => {
        const ported = [...listFiles(src), ...listFiles(join(root, "tests"))]
            .filter((file) => !file.endsWith("guard.test.ts"))
            .filter((file) => PORTED_HEADER.test(headOf(file)))
            .map((file) => file.slice(root.length + 1));
        expect(ported).toEqual([]);
        expect(
            PORTED_HEADER.test(
                "Derived from xyflow (packages/system/src/utils/edges), Copyright (c) 2019-2025 webkid GmbH, MIT",
            ),
        ).toBe(true);
        expect(
            PORTED_HEADER.test(
                "From Splitter (fragiola/splitter, x.ts), same author and licence.",
            ),
        ).toBe(false);
        expect(PORTED_HEADER.test("The React flow adapter's hooks.")).toBe(
            false,
        );
    });

    it("ships the repository's licence, and only the maintainer's", () => {
        const licence = readFileSync(join(root, "..", "..", "LICENSE"), "utf8");
        expect(readFileSync(join(root, "LICENSE"), "utf8")).toBe(licence);
        expect([...licence.matchAll(/Copyright \(c\)/g)]).toHaveLength(1);
        expect(licence).toContain("Copyright (c) 2026 Mauro de Souza");
    });
});
