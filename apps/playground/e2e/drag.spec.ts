import { expect, test } from "@playwright/test";
import {
    center,
    eventTypes,
    mouseDrag,
    node,
    nodeOf,
    openFixture,
    touchDrag,
} from "./helpers";

// Node drags: one node, the selection, a child kept in its group, a cancel, snapping, and a finger.

test("a dragged node moves by the pointer's distance, in one final step", async ({
    page,
}) => {
    await openFixture(page);
    const from = await center(node(page, "a"));
    await mouseDrag(page, from, { x: from.x + 50, y: from.y + 30 });
    expect((await nodeOf(page, "a")).position).toEqual({ x: 50, y: 30 });
    expect(await eventTypes(page)).toEqual(["drag-start", "nodes-move"]);
    await expect(node(page, "a")).toHaveAttribute("data-selected", "");
});

test("the node says it is dragged while it is", async ({ page }) => {
    await openFixture(page);
    const from = await center(node(page, "a"));
    await mouseDrag(
        page,
        from,
        { x: from.x + 20, y: from.y },
        { release: false },
    );
    await expect(node(page, "a")).toHaveAttribute("data-dragging", "");
    await page.mouse.up();
    await expect(node(page, "a")).not.toHaveAttribute("data-dragging", "");
});

test("a drag of a selected node moves the whole selection", async ({
    page,
}) => {
    await openFixture(page);
    await page.keyboard.down("Shift");
    await page.mouse.click(
        ...(Object.values(await center(node(page, "a"))) as [number, number]),
    );
    await page.mouse.click(
        ...(Object.values(await center(node(page, "b"))) as [number, number]),
    );
    await page.keyboard.up("Shift");
    const from = await center(node(page, "b"));
    await mouseDrag(page, from, { x: from.x, y: from.y + 40 });
    expect((await nodeOf(page, "a")).position).toEqual({ x: 0, y: 40 });
    expect((await nodeOf(page, "b")).position).toEqual({ x: 300, y: 40 });
});

test("Escape cancels a drag: the node goes back", async ({ page }) => {
    await openFixture(page);
    const from = await center(node(page, "a"));
    await mouseDrag(
        page,
        from,
        { x: from.x + 80, y: from.y },
        { release: false },
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect((await nodeOf(page, "a")).position).toEqual({ x: 0, y: 0 });
    expect(await eventTypes(page)).toContain("drag-cancel");
});

test("a child stays inside its group", async ({ page }) => {
    await openFixture(page);
    const from = await center(node(page, "d"));
    await mouseDrag(page, from, { x: from.x + 400, y: from.y + 300 });
    const d = await nodeOf(page, "d");
    const box = await node(page, "d").boundingBox();
    // the group is 240 × 160: the child's right and bottom edges stay inside
    expect(d.position.x + (box?.width ?? 0)).toBeLessThanOrEqual(240.5);
    expect(d.position.y + (box?.height ?? 0)).toBeLessThanOrEqual(160.5);
});

test("snap moves the node onto the grid", async ({ page }) => {
    await openFixture(page, "snap=20");
    const from = await center(node(page, "a"));
    await mouseDrag(page, from, { x: from.x + 47, y: from.y + 13 });
    expect((await nodeOf(page, "a")).position).toEqual({ x: 40, y: 20 });
});

test.describe("touch", () => {
    test.use({ hasTouch: true });

    test("a finger drags a node", async ({ page }) => {
        await openFixture(page);
        const from = await center(node(page, "a"));
        await touchDrag(page, from, { x: from.x + 60, y: from.y + 20 });
        await expect
            .poll(async () => (await nodeOf(page, "a")).position)
            .toEqual({ x: 60, y: 20 });
    });
});
