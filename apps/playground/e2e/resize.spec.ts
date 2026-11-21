import { expect, test } from "@playwright/test";
import {
    center,
    mouseDrag,
    node,
    nodeOf,
    openFixture,
    touchDrag,
} from "./helpers";

// The NodeResizer on c (160 × 80, the feature's minimum 80 × 40).

const at = (page: import("@playwright/test").Page, position: string) =>
    node(page, "c").locator(
        `[data-flow-part="resize-handle"][data-position="${position}"]`,
    );

test.beforeEach(async ({ page }) => {
    await openFixture(page);
});

test("a corner resizes both dimensions, a side one", async ({ page }) => {
    const corner = await center(at(page, "bottom-right"));
    await mouseDrag(page, corner, { x: corner.x + 40, y: corner.y + 20 });
    expect(await nodeOf(page, "c")).toMatchObject({ width: 200, height: 100 });
    const side = await center(at(page, "right"));
    await mouseDrag(page, side, { x: side.x - 30, y: side.y + 30 });
    expect(await nodeOf(page, "c")).toMatchObject({ width: 170, height: 100 });
});

test("the top-left corner moves the node, and the minimum holds", async ({
    page,
}) => {
    const corner = await center(at(page, "top-left"));
    await mouseDrag(page, corner, { x: corner.x + 200, y: corner.y + 200 });
    expect(await nodeOf(page, "c")).toMatchObject({
        width: 80,
        height: 40,
        position: { x: 80, y: 240 },
    });
});

test("the node says it is resized while it is", async ({ page }) => {
    const corner = await center(at(page, "bottom-right"));
    await mouseDrag(
        page,
        corner,
        { x: corner.x + 10, y: corner.y },
        { release: false },
    );
    await expect(node(page, "c")).toHaveAttribute("data-resizing", "");
    await page.mouse.up();
});

test.describe("touch", () => {
    test.use({ hasTouch: true });

    test("a finger resizes from a corner", async ({ page }) => {
        const corner = await center(at(page, "bottom-right"));
        await touchDrag(page, corner, { x: corner.x + 30, y: corner.y + 30 });
        await expect
            .poll(() => nodeOf(page, "c"))
            .toMatchObject({ width: 190, height: 110 });
    });
});
