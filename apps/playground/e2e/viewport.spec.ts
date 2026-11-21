import { expect, test } from "@playwright/test";
import {
    mouseDrag,
    openFixture,
    touch,
    touchDrag,
    viewportOf,
} from "./helpers";

// Pan and zoom, with the mouse, the wheel, a double click, the controls and fingers. The fixture's
// viewport starts at { x: 100, y: 100, zoom: 1 }; (700, 260) is the canvas, nothing over it.

const PANE = { x: 700, y: 260 };

test.beforeEach(async ({ page }) => {
    await openFixture(page);
});

test("a mouse drag on the canvas pans", async ({ page }) => {
    await mouseDrag(page, PANE, { x: PANE.x + 60, y: PANE.y + 40 });
    expect(await viewportOf(page)).toEqual({ x: 160, y: 140, zoom: 1 });
    await expect(page.locator('[data-flow-part="root"]')).not.toHaveAttribute(
        "data-panning",
        "",
    );
});

test("the root says it pans while it does", async ({ page }) => {
    await mouseDrag(
        page,
        PANE,
        { x: PANE.x + 30, y: PANE.y },
        { release: false },
    );
    await expect(page.locator('[data-flow-part="root"]')).toHaveAttribute(
        "data-panning",
        "",
    );
    await page.mouse.up();
});

test("the wheel zooms around the pointer, which stays over the same flow point", async ({
    page,
}) => {
    await page.mouse.move(PANE.x, PANE.y);
    await page.mouse.wheel(0, -200);
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeGreaterThan(1);
    const { x, y, zoom } = await viewportOf(page);
    // the flow point under the pointer is the one it was over: (600, 160)
    expect((PANE.x - x) / zoom).toBeCloseTo(600, 0);
    expect((PANE.y - y) / zoom).toBeCloseTo(160, 0);
});

test("a double click on the canvas zooms in", async ({ page }) => {
    await page.mouse.dblclick(PANE.x, PANE.y);
    await expect.poll(async () => (await viewportOf(page)).zoom).toBe(2);
});

test("the controls zoom, fit and stop at the limits", async ({ page }) => {
    const zoomIn = page.getByRole("button", { name: "zoom in" });
    await zoomIn.click();
    expect((await viewportOf(page)).zoom).toBeCloseTo(1.2, 5);
    for (let i = 0; i < 10 && (await zoomIn.isEnabled()); i++)
        await zoomIn.click();
    await expect(zoomIn).toBeDisabled();
    expect((await viewportOf(page)).zoom).toBe(2);
    await page.getByRole("button", { name: "fit view" }).click();
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeLessThan(2);
});

test.describe("touch", () => {
    test.use({ hasTouch: true });

    test("one finger on the canvas pans", async ({ page }) => {
        await touchDrag(page, PANE, { x: PANE.x - 50, y: PANE.y + 30 });
        await expect
            .poll(() => viewportOf(page))
            .toEqual({ x: 50, y: 130, zoom: 1 });
    });

    test("two fingers pinch to zoom", async ({ page }) => {
        await touch(page, [
            { from: { x: 650, y: 240 }, to: { x: 600, y: 240 } },
            { from: { x: 750, y: 240 }, to: { x: 800 - 2, y: 240 } },
        ]);
        await expect
            .poll(async () => (await viewportOf(page)).zoom)
            .toBeGreaterThan(1.3);
    });
});
