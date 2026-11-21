import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, near } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "custom-nodes");
});

test("the preview shows the colour and the size wired into it", async ({
    page,
}) => {
    const swatch = node(page, "preview").getByRole("img");
    await expect(swatch).toHaveAccessibleName("A 48 pixel swatch of #3b82f6");
    await node(page, "colour").locator('input[type="color"]').fill("#ff0000");
    await expect(swatch).toHaveAccessibleName("A 48 pixel swatch of #ff0000");
});

test("a field in a node keeps its presses: the node does not move", async ({
    page,
}) => {
    const size = node(page, "size");
    const before = await boxOf(size);
    const range = size.getByRole("slider");
    const box = await boxOf(range);
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, {
        steps: 5,
    });
    await page.mouse.up();
    near((await boxOf(size)).x, before.x, 1);
    await expect(node(page, "size")).toContainText("96px");
    await expect(node(page, "preview").getByRole("img")).toHaveAccessibleName(
        /A 96 pixel/,
    );
});

test("the preview's handles are its own: two targets on the left", async ({
    page,
}) => {
    const handles = node(page, "preview").locator('[data-flow-part="handle"]');
    await expect(handles).toHaveCount(2);
    for (const handle of await handles.all()) {
        await expect(handle).toHaveAttribute("data-side", "left");
    }
    await expect(part(page, "edge")).toHaveCount(2);
});
