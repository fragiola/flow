// From Splitter (fragiola/splitter, examples/shared/e2e/themes.spec.ts), same author and licence.
import { expect, type Page, test } from "@playwright/test";
import { handle, node, openExample, part, THEMES } from "./helpers";

// The example themes (examples/shared/src/themes) are every app's, so their checks run here, on
// computed styles (verify by compiling, not by reading class names). A theme changes the shape of
// a flow, not only its colours: a node's corners and frame (--fl-node-radius, --fl-node-border), a
// handle's size and shape (--fl-handle-size, --fl-handle-radius), an edge's stroke and dashes
// (--fl-edge-width, --fl-edge-dash) and the grid's pattern (--fl-grid-dots, -lines, -cross).

test("the themes paint different floors, whatever the page theme", async ({
    page,
}) => {
    const seen = new Set<string>();
    for (const theme of THEMES) {
        await page.goto(`./?theme=${theme.name}`);
        await expect(page.locator("body")).toHaveAttribute(
            "data-example-theme",
            theme.name,
        );
        seen.add(
            await page
                .getByTestId("stage")
                .evaluate((el) => getComputedStyle(el).backgroundColor),
        );
    }
    expect(seen.size).toBe(THEMES.length);
});

test("a theme declares the flow tokens the examples read", async ({ page }) => {
    for (const theme of THEMES) {
        await page.goto(`./?theme=${theme.name}`);
        const tokens = await page.getByTestId("stage").evaluate((el) => {
            const style = getComputedStyle(el);
            return [
                "--fl-font",
                "--fl-node-radius",
                "--fl-handle-size",
                "--fl-handle-radius",
                "--fl-edge-width",
                "--fl-edge-dash",
                "--fl-grid-dots",
                "--fl-canvas-bg",
                "--fl-edge-color",
                "--fl-focus-line",
            ].map((name) => style.getPropertyValue(name).trim());
        });
        for (const value of tokens) expect(value, theme.name).not.toBe("");
    }
});

/** How the theme draws the basic flow: what the eye meets of a node, a handle, an edge, the grid. */
async function flowShape(page: Page) {
    const card = await node(page, "start").evaluate((el) => {
        const style = getComputedStyle(el);
        return {
            radius: Number.parseFloat(style.borderTopLeftRadius),
            border: Number.parseFloat(style.borderTopWidth),
            font: style.fontFamily,
        };
    });
    const dot = await handle(page, "start", "source").evaluate((el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return {
            size: Number.parseFloat(style.width),
            round:
                style.borderTopLeftRadius === "50%" ||
                Number.parseFloat(style.borderTopLeftRadius) >=
                    box.width / 2 - 0.5,
        };
    });
    const stroke = await part(page, "edge-path")
        .first()
        .evaluate((el) => {
            const style = getComputedStyle(el);
            return {
                width: Number.parseFloat(style.strokeWidth),
                dash: style.strokeDasharray,
            };
        });
    const grid = await part(page, "background").evaluateAll((elements) =>
        elements
            .filter((el) => getComputedStyle(el).display !== "none")
            .map(
                (el) =>
                    el.querySelector('[data-flow-part="background-mark"]')
                        ?.tagName ?? "",
            ),
    );
    return { card, dot, stroke, grid };
}

test("a theme changes the shape of a flow, not only its colours", async ({
    page,
}) => {
    const shapes = new Map<string, Awaited<ReturnType<typeof flowShape>>>();
    for (const theme of THEMES) {
        await openExample(page, "basic", { theme: theme.name });
        const shape = await flowShape(page);
        // exactly one grid pattern shows
        expect(shape.grid, theme.name).toHaveLength(1);
        shapes.set(theme.name, shape);
    }
    const light = shapes.get("light");
    const dark = shapes.get("dark");
    const ide = shapes.get("ide");
    const paper = shapes.get("paper");
    const terminal = shapes.get("terminal");
    // dark keeps light's shapes
    expect(dark?.card.radius).toBe(light?.card.radius);
    expect(dark?.dot).toEqual(light?.dot);
    // light: round handles, rounded nodes, a dot grid
    expect(light?.dot.round).toBe(true);
    expect(light?.grid).toEqual(["circle"]);
    // ide: square handles smaller than light's, near-square nodes, hairline edges on lines
    expect(ide?.dot.round).toBe(false);
    expect(ide?.dot.size).toBeLessThan(light?.dot.size ?? 0);
    expect(ide?.card.radius).toBeLessThan(light?.card.radius ?? 0);
    expect(ide?.stroke.width).toBeLessThan(light?.stroke.width ?? 0);
    expect(ide?.grid).toEqual(["path"]);
    // paper: rounder nodes, bigger handles, thicker edges, a serif
    expect(paper?.card.radius).toBeGreaterThan(light?.card.radius ?? 0);
    expect(paper?.dot.size).toBeGreaterThan(light?.dot.size ?? 0);
    expect(paper?.stroke.width).toBeGreaterThan(light?.stroke.width ?? 0);
    expect(paper?.card.font).toMatch(/serif/i);
    // terminal: square everything, dashed edges, a monospace
    expect(terminal?.card.radius).toBe(0);
    expect(terminal?.dot.round).toBe(false);
    expect(terminal?.stroke.dash).not.toBe("none");
    expect(terminal?.card.font).toMatch(/mono/i);
    // no two of these themes draw it alike
    const drawn = ["light", "ide", "paper", "terminal"].map((name) => {
        const shape = shapes.get(name);
        return JSON.stringify({ ...shape, card: { ...shape?.card, font: "" } });
    });
    expect(new Set(drawn).size).toBe(drawn.length);
});
