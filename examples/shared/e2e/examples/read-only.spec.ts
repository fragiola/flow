import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, dragBy, dragFrom, near, viewportOf } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "read-only");
});

test("nothing moves, selects or connects", async ({ page }) => {
    const api = node(page, "api");
    const web = node(page, "web");
    const gap = async () => (await boxOf(api)).x - (await boxOf(web)).x;
    const before = await gap();
    await dragBy(page, api, 60, 60);
    // with no drag feature a press on a node pans like the canvas: the nodes keep their places
    near(await gap(), before, 1);
    await expect(api).not.toHaveAttribute("data-selected", "");
    await expect(part(page, "edge")).toHaveCount(6);
});

test("the viewport still pans and zooms", async ({ page }) => {
    const before = await viewportOf(page);
    const root = await boxOf(part(page, "root"));
    await dragFrom(
        page,
        { x: root.x + root.width - 40, y: root.y + root.height - 40 },
        -50,
        -30,
    );
    const after = await viewportOf(page);
    near(after.x - before.x, -50, 2);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeGreaterThan(after.zoom);
});
