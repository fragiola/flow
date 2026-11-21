// From Splitter (fragiola/splitter, examples/shared/tests/themes.test.ts), same author and licence.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "../src/themes/themes.ts";
import { blend, contrast, oklchToSrgb, parseOklch, type RGB } from "./color";

// The theme contract: every palette of every theme declares the six
// roles, every theme declares the same palettes and shape tokens, text
// meets WCAG AA on the surfaces it is drawn on, and a theme only sets values:
// it styles no markup, so everything an example looks like is in its own code.

const DIR = join(import.meta.dirname, "../src/themes");
const ROLES = ["base", "soft", "line", "contrast", "accent", "ring"] as const;
const TOKENS = [
    "font",
    "font-size",
    "title-weight",
    "node-padding",
    "node-radius",
    "node-border",
    "node-shadow",
    "handle-size",
    "handle-radius",
    "handle-border",
    "edge-width",
    "edge-selected-width",
    "edge-dash",
    "grid-dots",
    "grid-lines",
    "grid-cross",
    "control-radius",
    "focus-width",
    "motion",
    // per palette: they read the palette the element sits in
    "canvas-bg",
    "grid-color",
    "node-bg",
    "node-line",
    "edge-color",
    "edge-selected",
    "handle-bg",
    "handle-line",
    "valid",
    "invalid",
    "selection-bg",
    "selection-line",
    "minimap-mask",
    "focus-line",
];
const NEUTRAL = ["surface", "raised"];

type Palettes = Map<string, Map<string, string>>;

function parse(name: string): { palettes: Palettes; tokens: Set<string> } {
    const css = readFileSync(join(DIR, `${name}.css`), "utf-8");
    const palettes: Palettes = new Map();
    const block = new RegExp(
        String.raw`:root \[data-example-theme="${name}"\] \.palette-([a-z-]+),[^{]*\{([^}]*)\}`,
        "g",
    );
    for (const [, palette, body] of css.matchAll(block)) {
        const roles = new Map<string, string>();
        for (const [, role, value] of (body ?? "").matchAll(
            /--palette-([a-z]+):\s*([^;]+);/g,
        )) {
            roles.set(role ?? "", value ?? "");
        }
        palettes.set(palette ?? "", roles);
    }
    const tokens = new Set(
        [...css.matchAll(/--fl-([a-z-]+):/g)].map(([, token]) => token ?? ""),
    );
    return { palettes, tokens };
}

/** Every rule of a theme file: its selectors and the properties it declares. */
function rules(name: string): { selectors: string[]; properties: string[] }[] {
    const css = readFileSync(join(DIR, `${name}.css`), "utf-8").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
    );
    return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, head, body]) => ({
        selectors: (head ?? "")
            .split(",")
            .map((s) => s.trim().replace(/\s+/g, " ")),
        properties: (body ?? "")
            .split(";")
            .map((declaration) => declaration.split(":")[0]?.trim() ?? "")
            .filter(Boolean),
    }));
}

function color(roles: Map<string, string>, role: string): RGB {
    return oklchToSrgb(parseOklch(roles.get(role) ?? ""));
}

const parsed = THEMES.map((theme) => ({ theme, ...parse(theme.name) }));
const reference = parsed[0];

describe.each(parsed)("theme $theme.name", ({ theme, palettes, tokens }) => {
    it("only sets values: custom properties on the theme and on its palettes", () => {
        const scope = `[data-example-theme="${theme.name}"]`;
        const allowed = [
            scope,
            new RegExp(
                String.raw`^:root \[data-example-theme="${theme.name}"\] ?(\.palette-[a-z-]+|\[class\*="palette-"\])$`,
            ),
        ];
        for (const rule of rules(theme.name)) {
            for (const selector of rule.selectors) {
                expect(
                    allowed.some((pattern) =>
                        typeof pattern === "string"
                            ? pattern === selector
                            : pattern.test(selector),
                    ),
                    selector,
                ).toBe(true);
            }
            for (const property of rule.properties) {
                expect(
                    property.startsWith("--") || property === "color-scheme",
                    `${rule.selectors[0]}: ${property}`,
                ).toBe(true);
            }
        }
    });

    it("declares the same palettes as the others", () => {
        expect([...palettes.keys()].sort()).toEqual(
            [...(reference?.palettes.keys() ?? [])].sort(),
        );
        expect(palettes.size).toBeGreaterThanOrEqual(7);
    });

    it("declares all six roles in every palette", () => {
        for (const [palette, roles] of palettes) {
            expect([...roles.keys()].sort(), palette).toEqual(
                [...ROLES].sort(),
            );
        }
    });

    it("declares every shape token", () => {
        expect([...tokens].sort()).toEqual([...TOKENS].sort());
    });

    it("shows exactly one grid pattern, and draws handles and edges at a real size", () => {
        const css = readFileSync(
            join(DIR, `${theme.name}.css`),
            "utf-8",
        ).replace(/\/\*[\s\S]*?\*\//g, "");
        const token = (name: string) =>
            new RegExp(String.raw`--fl-${name}:\s*([^;]+);`).exec(css)?.[1];
        const grids = ["grid-dots", "grid-lines", "grid-cross"].map(token);
        for (const value of grids) expect(["block", "none"]).toContain(value);
        expect(grids.filter((value) => value === "block")).toHaveLength(1);
        const px = (name: string) => Number.parseFloat(token(name) ?? "");
        expect(px("handle-size")).toBeGreaterThanOrEqual(6);
        expect(px("edge-width")).toBeGreaterThan(0);
        expect(px("edge-selected-width")).toBeGreaterThan(px("edge-width"));
        expect(token("edge-dash")).toMatch(/^(none|\d+( \d+)*)$/);
    });

    it("draws contrast text on base at AA (4.5:1) in every palette", () => {
        for (const [palette, roles] of palettes) {
            const ratio = contrast(
                color(roles, "contrast"),
                color(roles, "base"),
            );
            expect(
                ratio,
                `${palette}: contrast on base`,
            ).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("draws secondary text (accent/85) at AA on the neutral surfaces", () => {
        for (const palette of NEUTRAL) {
            const roles = palettes.get(palette);
            expect(roles, palette).toBeDefined();
            if (!roles) continue;
            for (const background of ["base", "soft"]) {
                const bg = color(roles, background);
                const text = blend(color(roles, "accent"), bg, 0.85);
                expect(
                    contrast(text, bg),
                    `${palette}: accent/85 on ${background}`,
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    });
});
