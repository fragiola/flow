import { expect, test } from "@playwright/test";
import {
    center,
    mouseDrag,
    openFixture,
    touchDrag,
    viewportOf,
} from "./helpers";

// minimap(): every node drawn small, the view's mask, and the map pans and zooms the flow.

const map = (page: import("@playwright/test").Page) =>
    page
        .getByRole("img", { name: "Minimap" })
        .or(page.locator('[data-flow-part="minimap"]'))
        .first();

test.beforeEach(async ({ page }) => {
    await openFixture(page);
});

test("draws every node and the mask", async ({ page }) => {
    await expect(page.locator('[data-flow-part="minimap-node"]')).toHaveCount(
        5,
    );
    await expect(
        page.locator('[data-flow-part="minimap-mask"]'),
    ).toHaveAttribute("d", /^M/);
});

test("a drag in the map pans the flow the other way, scaled", async ({
    page,
}) => {
    const from = await center(map(page));
    await mouseDrag(page, from, { x: from.x + 20, y: from.y + 10 });
    const after = await viewportOf(page);
    // dragging the view right shows what is right of it: the flow moves left
    expect(after.x).toBeLessThan(100);
    expect(after.y).toBeLessThan(100);
});

test("the wheel over the map zooms", async ({ page }) => {
    const at = await center(map(page));
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, -200);
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeGreaterThan(1);
});

test.describe("touch", () => {
    test.use({ hasTouch: true });

    test("a finger in the map pans the flow", async ({ page }) => {
        const from = await center(map(page));
        await touchDrag(page, from, { x: from.x - 20, y: from.y });
        await expect
            .poll(async () => (await viewportOf(page)).x)
            .toBeGreaterThan(100);
    });
});
