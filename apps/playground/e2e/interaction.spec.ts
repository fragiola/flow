import { expect, type Page, test } from "@playwright/test";
import {
    center,
    documentOf,
    handle,
    mouseDrag,
    node,
    nodeOf,
    openFixture,
    touchDrag,
} from "./helpers";

// The interaction options and gesture events of #33 (Epic #34), in real browsers: a click versus a
// drag or a pan (the engine's taps, not the browser's retargeted `click`), double clicks and
// context menus, a viewport move's start and end, `selectOnDrag: false`, a handle that only starts
// and one that only ends, `reconnectable: "target"`, a drop on the pane making a node from
// `onConnectCancel`'s point, an async `beforeDelete`, `preventScrolling` and the connection
// threshold. The root's callbacks are logged in `gestures` (without their DOM event).

/** The gesture callbacks the fixture logged. */
async function gestures(
    page: Page,
): Promise<({ type: string } & Record<string, unknown>)[]> {
    return (
        await page.getByTestId("gestures").locator("li").allTextContents()
    ).map((text) => JSON.parse(text));
}

async function gestureTypes(page: Page, ...types: string[]) {
    return (await gestures(page))
        .map((event) => event.type)
        .filter((type) => types.length === 0 || types.includes(type));
}

test("a click on a node is told once, a drag of it is not a click", async ({
    page,
}) => {
    await openFixture(page);
    await expect.poll(() => gestureTypes(page, "ready")).toEqual(["ready"]);
    await node(page, "a").click();
    await expect
        .poll(() => gestures(page))
        .toContainEqual(
            expect.objectContaining({ type: "node-click", nodeId: "a" }),
        );
    const at = await center(node(page, "b"));
    await mouseDrag(page, at, { x: at.x + 60, y: at.y + 40 });
    expect((await nodeOf(page, "b")).position).toEqual({ x: 360, y: 40 });
    expect(await gestureTypes(page, "node-click")).toEqual(["node-click"]);
});

test("a pan is a move with one start and one end, and no pane click", async ({
    page,
}) => {
    await openFixture(page);
    await mouseDrag(page, { x: 700, y: 260 }, { x: 640, y: 230 });
    await expect
        .poll(() =>
            gestureTypes(
                page,
                "viewport-change-start",
                "viewport-change-end",
                "pane-click",
            ),
        )
        .toEqual(["viewport-change-start", "viewport-change-end"]);
    await page.mouse.click(700, 260);
    await expect
        .poll(() => gestureTypes(page, "pane-click"))
        .toEqual(["pane-click"]);
});

test("a touch tap on a node is a click, a finger's drag is not", async ({
    page,
}) => {
    await openFixture(page);
    const at = await center(node(page, "a"));
    await touchDrag(page, at, at);
    await expect
        .poll(() => gestureTypes(page, "node-click"))
        .toEqual(["node-click"]);
    await touchDrag(page, at, { x: at.x + 50, y: at.y });
    expect(await gestureTypes(page, "node-click")).toEqual(["node-click"]);
});

test("a double click on a node is the node's, and does not zoom; on the pane it zooms", async ({
    page,
}) => {
    await openFixture(page);
    await node(page, "a").dblclick();
    await expect
        .poll(() => gestures(page))
        .toContainEqual(
            expect.objectContaining({
                type: "node-double-click",
                nodeId: "a",
            }),
        );
    expect(await gestureTypes(page, "pane-double-click")).toEqual([]);
    await expect(page.getByTestId("viewport")).toContainText('"zoom":1');
    await page.mouse.dblclick(700, 260);
    await expect
        .poll(() => gestureTypes(page, "pane-double-click"))
        .toEqual(["pane-double-click"]);
    await expect(page.getByTestId("viewport")).toContainText('"zoom":2');
});

test("context menus on a node, the pane and the selection", async ({
    page,
}) => {
    await openFixture(page);
    await node(page, "a").click({ button: "right" });
    await page.mouse.click(700, 260, { button: "right" });
    await expect
        .poll(() =>
            gestureTypes(page, "node-context-menu", "pane-context-menu"),
        )
        .toEqual(["node-context-menu", "pane-context-menu"]);
    await node(page, "a").click();
    await node(page, "b").click({ modifiers: ["Shift"] });
    await node(page, "b").click({ button: "right" });
    await expect
        .poll(() => gestures(page))
        .toContainEqual(
            expect.objectContaining({
                type: "selection-context-menu",
                nodeIds: ["a", "b"],
            }),
        );
});

test("selectOnDrag: false drags a node without selecting it", async ({
    page,
}) => {
    await openFixture(page, "selectOnDrag=0");
    const at = await center(node(page, "a"));
    await mouseDrag(page, at, { x: at.x + 40, y: at.y + 20 });
    const a = await nodeOf(page, "a");
    expect(a.position).toEqual({ x: 40, y: 20 });
    expect(a.selected).toBeUndefined();
});

test("a start-only handle never ends a connection, an end-only one never starts", async ({
    page,
}) => {
    await openFixture(page, "roles=1");
    // b's source handle only ends: a drag from it starts no connection
    await mouseDrag(
        page,
        await center(handle(page, "b", "source")),
        await center(handle(page, "c", "target")),
    );
    expect((await documentOf(page)).edges).toHaveLength(1);
    // a drop on a's target handle (start only) adds nothing
    await mouseDrag(
        page,
        await center(handle(page, "c", "source")),
        await center(handle(page, "a", "target")),
    );
    expect((await documentOf(page)).edges).toHaveLength(1);
    // from a's target handle a connection does start, and ends at c's source
    await mouseDrag(
        page,
        await center(handle(page, "a", "target")),
        await center(handle(page, "c", "source")),
    );
    expect(
        (await documentOf(page)).edges.map((e) => [e.source, e.target]),
    ).toEqual([
        ["a", "b"],
        ["c", "a"],
    ]);
});

test('reconnectable: "target" draws the target anchor only, and moves that end', async ({
    page,
}) => {
    await openFixture(page, "reconnectable=target");
    await expect(
        page.locator('[data-flow-part="reconnect-anchor"]'),
    ).toHaveCount(1);
    await expect(
        page.locator('[data-flow-part="reconnect-anchor"][data-end="target"]'),
    ).toHaveCount(1);
    // the anchor lies under b's handle (edges are drawn before nodes): grab it just beside
    const end = await center(
        page.locator('[data-flow-part="reconnect-anchor"][data-end="target"]'),
    );
    await mouseDrag(
        page,
        { x: end.x - 7, y: end.y - 5 },
        await center(handle(page, "c", "target")),
    );
    expect((await documentOf(page)).edges[0]).toMatchObject({
        source: "a",
        target: "c",
    });
});

test("a connection dropped on the pane adds a node at the drop point", async ({
    page,
}) => {
    await openFixture(page, "dropToAdd=1");
    await mouseDrag(page, await center(handle(page, "a", "source")), {
        x: 150,
        y: 450,
    });
    await expect(page.locator('[data-flow-part="node"]')).toHaveCount(6);
    const { nodes, edges } = await documentOf(page);
    const added = nodes.at(-1);
    // the fixture's viewport is at { x: 100, y: 100 }: page (150, 450) is flow (50, 350)
    expect(added?.position).toEqual({ x: 50, y: 350 });
    expect(edges.at(-1)).toMatchObject({ source: "a", target: added?.id });
});

test("an async beforeDelete waits for its answer", async ({ page }) => {
    await openFixture(page, "confirmDelete=1");
    await node(page, "a").click();
    await node(page, "a").press("Delete");
    await expect(page.getByTestId("confirm-delete")).toContainText("Delete a?");
    await expect(node(page, "a")).toHaveCount(1);
    await page.getByRole("button", { name: "Keep" }).click();
    await expect(node(page, "a")).toHaveCount(1);
    await node(page, "a").click();
    await node(page, "a").press("Delete");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(node(page, "a")).toHaveCount(0);
    expect((await documentOf(page)).edges).toEqual([]);
});

test("preventScrolling keeps the page still under a wheel the flow does not use", async ({
    page,
}) => {
    await openFixture(page, "tall=1&zoomOnScroll=0");
    await page.mouse.move(700, 260);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await openFixture(page, "tall=1&zoomOnScroll=0&preventScrolling=0");
    await page.mouse.move(700, 260);
    await page.mouse.wheel(0, 400);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
});

test("the connection threshold keeps a short press on a handle from connecting", async ({
    page,
}) => {
    await openFixture(page, "threshold=10");
    const at = await center(handle(page, "a", "source"));
    await mouseDrag(page, at, { x: at.x + 6, y: at.y }, { release: false });
    await expect(
        page.locator('[data-flow-part="connection-line"]'),
    ).toHaveCount(0);
    await page.mouse.move(at.x + 40, at.y + 40, { steps: 4 });
    await expect(
        page.locator('[data-flow-part="connection-line"]'),
    ).toHaveCount(1);
    await page.mouse.up();
});

test("the lock turns dragging, connecting and selecting off, pan stays", async ({
    page,
}) => {
    await openFixture(page);
    const lock = page.getByRole("button", { name: "lock" });
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "true");
    const at = await center(node(page, "a"));
    await mouseDrag(page, at, { x: at.x + 40, y: at.y });
    expect((await nodeOf(page, "a")).position).toEqual({ x: 0, y: 0 });
    await node(page, "a").click();
    expect((await nodeOf(page, "a")).selected).toBeUndefined();
    await mouseDrag(page, { x: 700, y: 260 }, { x: 650, y: 260 });
    await expect(page.getByTestId("viewport")).toContainText('"x":50');
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "false");
});
