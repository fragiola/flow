import { expect, test } from "@playwright/test";
import { center, documentOf, node, openFixture, touchDrag } from "./helpers";

// Clicks, Shift-clicks and the selection box.

const selected = async (page: import("@playwright/test").Page) =>
    (await documentOf(page)).nodes.filter((n) => n.selected).map((n) => n.id);

test("a click selects one node, Shift adds, the canvas clears", async ({
    page,
}) => {
    await openFixture(page);
    const a = await center(node(page, "a"));
    const b = await center(node(page, "b"));
    await page.mouse.click(a.x, a.y);
    expect(await selected(page)).toEqual(["a"]);
    await page.keyboard.down("Shift");
    await page.mouse.click(b.x, b.y);
    await page.keyboard.up("Shift");
    expect(await selected(page)).toEqual(["a", "b"]);
    await page.mouse.click(700, 260);
    expect(await selected(page)).toEqual([]);
});

test("a click on an edge selects it", async ({ page }) => {
    await openFixture(page);
    const path = page.locator('[data-flow-part="edge-path"]');
    const box = await path.boundingBox();
    // the bezier passes through its middle
    await page.mouse.click(
        (box?.x ?? 0) + (box?.width ?? 0) / 2,
        (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    expect((await documentOf(page)).edges[0]?.selected).toBe(true);
    await expect(path).toHaveAttribute("data-selected", "");
});

test("Shift and a drag draw a box that selects what it covers", async ({
    page,
}) => {
    await openFixture(page);
    await page.keyboard.down("Shift");
    await page.mouse.move(60, 60);
    await page.mouse.down();
    await page.mouse.move(620, 180, { steps: 10 });
    await expect(
        page.locator('[data-flow-part="selection-box"]'),
    ).toBeVisible();
    await expect(page.locator('[data-flow-part="root"]')).toHaveAttribute(
        "data-selecting",
        "",
    );
    await page.mouse.up();
    await page.keyboard.up("Shift");
    expect(await selected(page)).toEqual(["a", "b"]);
    await expect(page.locator('[data-flow-part="selection-box"]')).toHaveCount(
        0,
    );
});

test.describe("touch", () => {
    test.use({ hasTouch: true });

    test("with boxOnDrag, a finger on the canvas draws the box", async ({
        page,
    }) => {
        await openFixture(page, "boxOnDrag=1");
        await touchDrag(page, { x: 60, y: 260 }, { x: 300, y: 420 });
        await expect.poll(() => selected(page)).toEqual(["c"]);
    });
});
