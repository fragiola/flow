import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, dragBy, middle, near, viewportOf } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "minimap-and-controls");
});

test("the zoom buttons zoom, and stop at the limits", async ({ page }) => {
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    const before = await viewportOf(page);
    await zoomIn.click();
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeGreaterThan(before.zoom);
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++)
        await zoomIn.click();
    await expect(zoomIn).toBeDisabled();
    await expect(zoomIn).toHaveAttribute("data-disabled", "");
    near((await viewportOf(page)).zoom, 2, 0.01);
    await page.getByRole("button", { name: "Fit view" }).click();
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeLessThan(1);
});

test("the lock stops dragging, and pan still works", async ({ page }) => {
    const lock = page.getByRole("button", { name: "Lock the flow" });
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "true");
    await expect(part(page, "root")).not.toHaveAttribute(
        "data-interactive",
        "",
    );
    const paris = node(page, "paris");
    const rome = node(page, "rome");
    const gap = async () => (await boxOf(rome)).x - (await boxOf(paris)).x;
    const before = await gap();
    await dragBy(page, paris, 60, 0);
    near(await gap(), before, 1);
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "false");
});

test("the minimap shows every node, and a drag in it pans the flow", async ({
    page,
}) => {
    await expect(part(page, "minimap-node")).toHaveCount(10);
    const before = await viewportOf(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    const zoomed = await viewportOf(page);
    expect(zoomed.zoom).toBeGreaterThan(before.zoom);
    const map = await middle(part(page, "minimap"));
    await page.mouse.move(map.x, map.y);
    await page.mouse.down();
    await page.mouse.move(map.x + 30, map.y + 20, { steps: 6 });
    await page.mouse.up();
    const after = await viewportOf(page);
    expect(after.x).not.toBe(zoomed.x);
});
