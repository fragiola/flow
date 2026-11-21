import { expect, test } from "@playwright/test";
import { edge, handle, node, openExample, part } from "../helpers";
import {
    boxOf,
    dragBy,
    dragFrom,
    dragTo,
    near,
    press,
    viewportOf,
} from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "basic");
});

test("draws four nodes and three edges", async ({ page }) => {
    await expect(part(page, "node")).toHaveCount(4);
    await expect(part(page, "edge")).toHaveCount(3);
});

test("a dragged node follows the pointer, and its edges with it", async ({
    page,
}) => {
    const start = node(page, "start");
    const before = await boxOf(start);
    const path = edge(page, "start-fetch").locator(
        '[data-flow-part="edge-path"]',
    );
    const d = await path.getAttribute("d");
    await dragBy(page, start, 80, 40);
    const after = await boxOf(start);
    near(after.x - before.x, 80, 2);
    near(after.y - before.y, 40, 2);
    await expect(path).not.toHaveAttribute("d", d ?? "");
    // a press selects it
    await expect(start).toHaveAttribute("data-selected", "");
});

test("a drag on the canvas pans the viewport", async ({ page }) => {
    const before = await viewportOf(page);
    const root = await boxOf(part(page, "root"));
    await dragFrom(page, { x: root.x + 20, y: root.y + 20 }, 100, 50);
    const after = await viewportOf(page);
    near(after.x - before.x, 100, 2);
    near(after.y - before.y, 50, 2);
});

test("the wheel zooms around the pointer", async ({ page }) => {
    const before = await viewportOf(page);
    const root = await boxOf(part(page, "root"));
    await page.mouse.move(root.x + root.width / 2, root.y + root.height / 2);
    await page.mouse.wheel(0, -300);
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeGreaterThan(before.zoom);
});

test("an edge is drawn from a source handle to a target handle", async ({
    page,
}) => {
    await dragTo(
        page,
        handle(page, "parse", "source"),
        handle(page, "save", "target"),
    );
    await expect(part(page, "edge")).toHaveCount(4);
});

test("a click on the canvas clears the selection", async ({ page }) => {
    await press(page, node(page, "fetch"));
    await expect(node(page, "fetch")).toHaveAttribute("data-selected", "");
    const root = await boxOf(part(page, "root"));
    await page.mouse.click(root.x + 10, root.y + root.height - 10);
    await expect(node(page, "fetch")).not.toHaveAttribute("data-selected", "");
});
