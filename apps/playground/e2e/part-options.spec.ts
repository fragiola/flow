import { expect, type Page, test } from "@playwright/test";
import {
    center,
    mouseDrag,
    node,
    nodeOf,
    openFixture,
    touchDrag,
    viewportOf,
} from "./helpers";

// #36: the minimap's inversePan and onClick, a horizontal resizer, the rectangle around a box
// selection (`Flow.NodesSelection`) and its drag, and an animated edge's attribute.

const map = (page: Page) => page.locator('[data-flow-part="minimap"]');

const gestureTypes = async (page: Page) =>
    (await page.getByTestId("gestures").locator("li").allTextContents()).map(
        (text) => (JSON.parse(text) as { type: string }).type,
    );

/** Shift and a drag over a and b: a box selection of both. */
async function boxSelectAB(page: Page) {
    await page.keyboard.down("Shift");
    await mouseDrag(page, { x: 60, y: 60 }, { x: 620, y: 180 });
    await page.keyboard.up("Shift");
}

test("the minimap with inversePan grabs the flow: a press keeps the view, a drag moves it the pointer's way", async ({
    page,
}) => {
    await openFixture(page, "inversePan=1");
    const from = await center(map(page));
    await mouseDrag(
        page,
        from,
        { x: from.x, y: from.y },
        { release: false, steps: 1 },
    );
    expect(await viewportOf(page)).toEqual({ x: 100, y: 100, zoom: 1 });
    await page.mouse.move(from.x + 20, from.y + 10, { steps: 5 });
    await page.mouse.up();
    const after = await viewportOf(page);
    // the opposite of the default (the flow moves left there)
    expect(after.x).toBeGreaterThan(100);
    expect(after.y).toBeGreaterThan(100);
});

test("a tap on the minimap calls its onClick with the flow point under it, a drag does not", async ({
    page,
}) => {
    await openFixture(page);
    const clicks = page.getByTestId("minimap-clicks").locator("li");
    const at = await center(map(page));
    await page.mouse.click(at.x, at.y);
    await expect(clicks).toHaveCount(1);
    const point = JSON.parse((await clicks.first().textContent()) ?? "{}");
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
    await mouseDrag(page, at, { x: at.x + 30, y: at.y });
    await expect(clicks).toHaveCount(1);
});

test("a horizontal resizer moves only the width, from a corner too", async ({
    page,
}) => {
    await openFixture(page, "direction=horizontal");
    const corner = await center(
        node(page, "c").locator('[data-position="bottom-right"]'),
    );
    await mouseDrag(page, corner, { x: corner.x + 40, y: corner.y + 20 });
    expect(await nodeOf(page, "c")).toMatchObject({ width: 200, height: 80 });
});

test("a box selection of two nodes draws the rectangle around them, which drags them", async ({
    page,
}) => {
    await openFixture(page, "nodesSelection=1");
    const rect = page.locator('[data-flow-part="nodes-selection"]');
    await expect(rect).toHaveCount(0);
    await boxSelectAB(page);
    await expect(rect).toBeVisible();
    const box = await rect.boundingBox();
    const a = await node(page, "a").boundingBox();
    const b = await node(page, "b").boundingBox();
    // around a and b, in the viewport
    expect(box?.x).toBeCloseTo(a?.x ?? 0, 0);
    expect(box?.y).toBeCloseTo(a?.y ?? 0, 0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeCloseTo(
        (b?.x ?? 0) + (b?.width ?? 0),
        0,
    );
    const before = {
        a: (await nodeOf(page, "a")).position,
        b: (await nodeOf(page, "b")).position,
    };
    const from = await center(rect);
    await mouseDrag(page, from, { x: from.x + 30, y: from.y + 20 });
    expect((await nodeOf(page, "a")).position).toEqual({
        x: before.a.x + 30,
        y: before.a.y + 20,
    });
    expect((await nodeOf(page, "b")).position).toEqual({
        x: before.b.x + 30,
        y: before.b.y + 20,
    });
    await expect(rect).toBeVisible();
    const types = await gestureTypes(page);
    expect(types).toContain("selection-drag-start");
    expect(types).toContain("selection-drag-end");
    // a click elsewhere ends the selection and the rectangle
    await page.mouse.click(700, 260);
    await expect(rect).toHaveCount(0);
});

test("an animated edge carries data-animated", async ({ page }) => {
    await openFixture(page);
    await expect(page.locator('[data-flow-part="edge"]')).not.toHaveAttribute(
        "data-animated",
    );
    await openFixture(page, "animated=1");
    await expect(page.locator('[data-flow-part="edge"]')).toHaveAttribute(
        "data-animated",
        "",
    );
});

test.describe("touch", () => {
    test.use({ hasTouch: true });

    test("a finger drags the rectangle around the selection", async ({
        page,
    }) => {
        await openFixture(page, "nodesSelection=1&boxOnDrag=1");
        const rect = page.locator('[data-flow-part="nodes-selection"]');
        await touchDrag(page, { x: 60, y: 60 }, { x: 620, y: 180 });
        await expect(rect).toBeVisible();
        const before = (await nodeOf(page, "a")).position;
        const from = await center(rect);
        await touchDrag(page, from, { x: from.x + 30, y: from.y + 20 });
        await expect
            .poll(async () => (await nodeOf(page, "a")).position)
            .toEqual({ x: before.x + 30, y: before.y + 20 });
    });
});
