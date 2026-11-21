import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, dragBy, near, press, viewportOf } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "node-resizer");
});

const corner = (
    page: import("@playwright/test").Page,
    id: string,
    position: string,
) =>
    node(page, id).locator(
        `[data-flow-part="resize-handle"][data-position="${position}"]`,
    );

test("a corner resizes the node, within its limits", async ({ page }) => {
    const note = node(page, "note");
    const { zoom } = await viewportOf(page);
    const before = await boxOf(note);
    await dragBy(page, corner(page, "note", "bottom-right"), 40, 30);
    const after = await boxOf(note);
    near(after.width - before.width, 40, 2);
    near(after.height - before.height, 30, 2);
    // the maximum width, 360 flow units
    await dragBy(page, corner(page, "note", "bottom-right"), 300, 0);
    near((await boxOf(note)).width, 360 * zoom, 2);
    // the minimum, 120 × 80
    await dragBy(page, corner(page, "note", "top-left"), 250, 200);
    const smallest = await boxOf(note);
    near(smallest.width, 120 * zoom, 2);
    near(smallest.height, 80 * zoom, 2);
});

test("the photo keeps its aspect ratio", async ({ page }) => {
    const photo = node(page, "photo");
    await press(page, photo);
    await expect(photo).toHaveAttribute("data-selected", "");
    const before = await boxOf(photo);
    await dragBy(page, corner(page, "photo", "bottom-right"), 80, 0);
    const after = await boxOf(photo);
    expect(after.width).toBeGreaterThan(before.width);
    near(after.width / after.height, before.width / before.height, 0.02);
    await expect(part(page, "resizer")).toHaveCount(2);
});
