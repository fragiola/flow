import { expect, type Locator, type Page, test } from "@playwright/test";
import {
    center,
    documentOf,
    handle,
    mouseDrag,
    node,
    openFixture,
    viewportOf,
} from "./helpers";

// The edge toolbar (`?edgeToolbar=1`: on ab, 24 px above its label point, shown while ab is
// selected), the toolbar of several nodes (`?nodeToolbar=1`: a and b's, shown while both are
// selected) and the simple bezier (`?edgeType=simplebezier`). Toolbars stand outside the zoom: they
// keep their size, and follow the flow as it pans and zooms. (700, 260) is the canvas.

const PANE = { x: 700, y: 260 };

const edgeToolbar = (page: Page) =>
    page.locator('[data-flow-part="toolbar"][data-flow-id="ab"]');

/** The middle of ab's path on screen: its label point (the curve is symmetric about it). */
async function middleOfAb(page: Page) {
    return page
        .locator(
            '[data-flow-part="edge"][data-flow-id="ab"] [data-flow-part="edge-path"]',
        )
        .evaluate((element) => {
            const path = element as SVGPathElement;
            const point = path.getPointAtLength(path.getTotalLength() / 2);
            const matrix = path.getScreenCTM();
            if (!matrix) return { x: Number.NaN, y: Number.NaN };
            const screen = new DOMPoint(point.x, point.y).matrixTransform(
                matrix,
            );
            return { x: screen.x, y: screen.y };
        });
}

/** Within a tolerance: what sub-pixel layout rounds to. */
function near(actual: number, expected: number, tolerance = 1.5) {
    expect(
        Math.abs(actual - expected),
        `${actual} ≈ ${expected}`,
    ).toBeLessThanOrEqual(tolerance);
}

/** Waits until the viewport the fixture prints stays the same across two polls. */
async function settled(page: Page) {
    let last = "";
    await expect
        .poll(async () => {
            const now = JSON.stringify(await viewportOf(page));
            const same = now === last;
            last = now;
            return same;
        })
        .toBe(true);
}

/** Expects the toolbar's centre 24 px above ab's middle, at its size. */
async function onAb(page: Page, toolbar: Locator, size?: { width: number }) {
    const middle = await middleOfAb(page);
    const at = await center(toolbar);
    near(at.x, middle.x);
    near(at.y, middle.y - 24);
    if (size) near((await toolbar.boundingBox())?.width ?? 0, size.width);
}

test("an edge toolbar shows while its edge is selected, at its label point", async ({
    page,
}) => {
    await openFixture(page, "edgeToolbar=1");
    await expect(edgeToolbar(page)).toHaveCount(0);
    const ab = page.locator('[data-flow-part="edge"][data-flow-id="ab"]');
    await ab.focus();
    await page.keyboard.press("Enter");
    await expect(edgeToolbar(page)).toBeVisible();
    await expect(edgeToolbar(page)).toHaveAccessibleName("Edge ab toolbar");
    await expect(() => onAb(page, edgeToolbar(page))).toPass();
    // Escape clears the selection, and the toolbar goes
    await page.keyboard.press("Escape");
    await expect(edgeToolbar(page)).toHaveCount(0);
});

test("an edge toolbar follows the zoom and the pan at its own size", async ({
    page,
}) => {
    await openFixture(page, "edgeToolbar=1");
    await page.locator('[data-flow-part="edge"][data-flow-id="ab"]').focus();
    await page.keyboard.press("Enter");
    const toolbar = edgeToolbar(page);
    await expect(toolbar).toBeVisible();
    const size = { width: (await toolbar.boundingBox())?.width ?? 0 };
    await page.getByRole("button", { name: "zoom in" }).click();
    await settled(page);
    expect((await viewportOf(page)).zoom).toBeGreaterThan(1);
    await expect(() => onAb(page, toolbar, size)).toPass();
    await mouseDrag(page, PANE, { x: PANE.x - 60, y: PANE.y + 40 });
    await settled(page);
    await expect(() => onAb(page, toolbar, size)).toPass();
    // a node move moves the label point too (the arrows move the focused node, and a press on
    // b would select it instead of ab)
    await node(page, "b").focus();
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Shift+ArrowRight");
    await expect(toolbar).toBeVisible();
    await expect(() => onAb(page, toolbar, size)).toPass();
});

test("an edge toolbar's button runs a command", async ({ page }) => {
    await openFixture(page, "edgeToolbar=1");
    await page.locator('[data-flow-part="edge"][data-flow-id="ab"]').focus();
    await page.keyboard.press("Enter");
    await edgeToolbar(page).getByRole("button", { name: "remove ab" }).click();
    await expect(page.locator('[data-flow-part="edge"]')).toHaveCount(0);
    await expect(edgeToolbar(page)).toHaveCount(0);
    expect((await documentOf(page)).edges).toEqual([]);
});

test("a toolbar for several nodes shows while every one of them is selected, beside their bounds", async ({
    page,
}) => {
    await openFixture(page, "nodeToolbar=1");
    const toolbar = page.getByLabel("a and b toolbar");
    await expect(toolbar).toHaveCount(0);
    const first = await center(node(page, "a"));
    await page.mouse.click(first.x, first.y);
    await expect(node(page, "a")).toHaveAttribute("data-selected", "");
    // a alone is not both
    await expect(toolbar).toHaveCount(0);
    await page.keyboard.down("Shift");
    const b = await center(node(page, "b"));
    await page.mouse.click(b.x, b.y);
    await page.keyboard.up("Shift");
    await expect(node(page, "b")).toHaveAttribute("data-selected", "");
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute("data-flow-part", "toolbar");
    await expect(toolbar).not.toHaveAttribute("data-flow-id", /.*/);
    const beside = async () => {
        const a = await node(page, "a").boundingBox();
        const right = await node(page, "b").boundingBox();
        const box = await toolbar.boundingBox();
        if (!a || !right || !box) throw new Error("not on screen");
        // centred over the two nodes' bounds, 10 px above them
        near(box.x + box.width / 2, (a.x + right.x + right.width) / 2);
        near(box.y + box.height, Math.min(a.y, right.y) - 10);
    };
    await expect(beside).toPass();
    const width = (await toolbar.boundingBox())?.width ?? 0;
    await page.getByRole("button", { name: "zoom out" }).click();
    await settled(page);
    expect((await viewportOf(page)).zoom).toBeLessThan(1);
    await expect(beside).toPass();
    near((await toolbar.boundingBox())?.width ?? 0, width);
    // a click on a alone: b leaves the selection, and the toolbar goes
    const a = await center(node(page, "a"));
    await page.mouse.click(a.x, a.y);
    await expect(node(page, "b")).not.toHaveAttribute("data-selected", "");
    await expect(toolbar).toHaveCount(0);
});

test("a simplebezier edge is one curve, its control points halfway on each end's axis", async ({
    page,
}) => {
    await openFixture(page, "edgeType=simplebezier");
    const d =
        (await page
            .locator(
                '[data-flow-part="edge"][data-flow-id="ab"] [data-flow-part="edge-path"]',
            )
            .getAttribute("d")) ?? "";
    const numbers = [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]));
    expect(d).toMatch(/^M[^C]+C[^C]+$/);
    expect(numbers).toHaveLength(8);
    const [sx, sy, c1x, c1y, c2x, c2y, tx, ty] = numbers as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
    ];
    // a's source handle leaves by the bottom, b's target enters by the top: vertical axes
    near(c1x, sx, 0.01);
    near(c2x, tx, 0.01);
    near(c1y, (sy + ty) / 2, 0.01);
    near(c2y, (sy + ty) / 2, 0.01);
    // its ends are the handles' centres, in flow coordinates (the viewport is at 100, 100)
    const source = await center(handle(page, "a", "source"));
    const target = await center(handle(page, "b", "target"));
    near(sx + 100, source.x);
    near(sy + 100, source.y);
    near(tx + 100, target.x);
    near(ty + 100, target.y);
});
