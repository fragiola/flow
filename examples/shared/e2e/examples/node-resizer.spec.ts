import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import {
    boxOf,
    dragBy,
    expectNamedHandles,
    near,
    press,
    viewportOf,
} from "./helpers";

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

test("the arrows on a focused handle resize by a step, Shift by a bigger one, within the limits", async ({
    page,
}) => {
    const note = node(page, "note");
    const { zoom } = await viewportOf(page);
    const width = async () => (await boxOf(note)).width / zoom;
    // how far a size (in flow units, from the screen box) is from what it should be
    const off = (size: () => Promise<number>, expected: number) => async () =>
        Math.abs((await size()) - expected);
    // the note starts 200 × 120; keyboard() steps by 5, Shift by 20
    const right = corner(page, "note", "right");
    await right.focus();
    await expect(right).toBeFocused();
    await expect(right).toHaveAccessibleName("Resize note: right");
    await page.keyboard.press("ArrowRight");
    await expect.poll(off(width, 205)).toBeLessThan(1.5);
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(off(width, 225)).toBeLessThan(1.5);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(off(width, 220)).toBeLessThan(1.5);
    // a corner takes both axes
    const height = async () => (await boxOf(note)).height / zoom;
    await corner(page, "note", "bottom-right").focus();
    await page.keyboard.press("ArrowDown");
    await expect.poll(off(height, 125)).toBeLessThan(1.5);
    // the minimum width, 120: Shift + Arrow Left from 220 five times stops there
    await right.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowLeft");
    await expect.poll(off(width, 120)).toBeLessThan(1.5);
});

test("every resize handle a keyboard reaches has a name", async ({ page }) => {
    await expectNamedHandles(page, 8);
});
