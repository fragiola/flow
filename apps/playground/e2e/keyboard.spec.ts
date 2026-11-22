import { expect, test } from "@playwright/test";
import {
    documentOf,
    events,
    handle,
    node,
    nodeOf,
    openFixture,
} from "./helpers";

// keyboard(): nodes and edges take focus; Enter selects, the arrows move, Delete removes, Escape
// clears. With connection() and resize() (the fixture has both), handles and resize handles take
// focus too: Enter on a handle draws an edge, the arrows on a resize handle resize.

test.beforeEach(async ({ page }) => {
    await openFixture(page);
});

test("Tab reaches the nodes and their handles, which carry their names", async ({
    page,
}) => {
    await node(page, "a").focus();
    await expect(node(page, "a")).toBeFocused();
    await expect(node(page, "a")).toHaveAttribute("tabindex", "0");
    // a's handles are inside it: Tab walks them next (keyboard() with connection())
    await page.keyboard.press("Tab");
    await expect(handle(page, "a", "target")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(handle(page, "a", "source")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute(
        "data-flow-part",
        /node|edge/,
    );
});

test("the arrows move the focused node, Shift by a bigger step", async ({
    page,
}) => {
    await node(page, "a").focus();
    await page.keyboard.press("ArrowRight");
    expect((await nodeOf(page, "a")).position).toEqual({ x: 5, y: 0 });
    await page.keyboard.press("Shift+ArrowDown");
    expect((await nodeOf(page, "a")).position).toEqual({ x: 5, y: 20 });
});

test("Enter selects, Delete removes the node and its edges, Escape clears", async ({
    page,
}) => {
    await node(page, "b").focus();
    await page.keyboard.press("Enter");
    await expect(node(page, "b")).toHaveAttribute("data-selected", "");
    await page.keyboard.press("Escape");
    await expect(node(page, "b")).not.toHaveAttribute("data-selected", "");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Delete");
    await expect(node(page, "b")).toHaveCount(0);
    expect((await documentOf(page)).edges).toEqual([]);
});

test("the lock stops the keys from changing the flow", async ({ page }) => {
    await page.getByRole("button", { name: "lock" }).click();
    await node(page, "a").focus();
    await page.keyboard.press("ArrowRight");
    expect((await nodeOf(page, "a")).position).toEqual({ x: 0, y: 0 });
});

// ─── A keyboard connection ──────────────────────────────────────────────────
// From c's source handle: the targets are the target handles the model accepts (b's is refused,
// a→b exists only from a), nearest first, so c's own comes first (a self loop is allowed).

/** The node whose handle the keyboard connection points at (`data-valid`). */
async function pointedAt(page: import("@playwright/test").Page) {
    const valid = page.locator('[data-flow-part="handle"][data-valid]');
    await expect(valid).toHaveCount(1);
    return valid.evaluate(
        (element) =>
            element
                .closest('[data-flow-part="node"]')
                ?.getAttribute("data-flow-id") ?? "",
    );
}

/** The `connect-target` events, in order. */
async function targets(page: import("@playwright/test").Page) {
    return (await events(page)).filter(
        (event) => event.type === "connect-target",
    );
}

test("Enter on a handle starts a connection, Tab moves its target, Enter adds the edge", async ({
    page,
}) => {
    const source = handle(page, "c", "source");
    await source.focus();
    await page.keyboard.press("Enter");
    const root = page.getByTestId("root");
    await expect(root).toHaveAttribute("data-connecting", "");
    await expect(
        page.locator('[data-flow-part="connection-line"]'),
    ).toHaveCount(1);
    expect(await pointedAt(page)).toBe("c");
    await expect.poll(async () => (await targets(page)).length).toBe(1);
    const [first] = await targets(page);
    expect(first).toMatchObject({
        nodeId: "c",
        handleType: "target",
        index: 0,
    });
    const count = Number(first?.count);
    expect(count).toBeGreaterThan(1);
    // Tab points at the next target; the focus stays on the source handle
    await page.keyboard.press("Tab");
    await expect(source).toBeFocused();
    await expect.poll(async () => (await targets(page)).length).toBe(2);
    expect((await targets(page))[1]).toMatchObject({ index: 1, count });
    const target = await pointedAt(page);
    expect(target).not.toBe("c");
    await page.keyboard.press("Enter");
    await expect(root).not.toHaveAttribute("data-connecting", "");
    await expect(page.locator('[data-flow-part="edge"]')).toHaveCount(2);
    expect(
        (await documentOf(page)).edges.map((e) => [e.source, e.target]),
    ).toContainEqual(["c", target]);
    const types = (await events(page)).map((event) => event.type);
    expect(types).toContain("connect");
    expect(
        (await events(page)).filter((event) =>
            event.type.startsWith("connect"),
        ),
    ).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                type: "connect-start",
                input: "keyboard",
            }),
            expect.objectContaining({
                type: "connect",
                source: "c",
                target,
                input: "keyboard",
            }),
        ]),
    );
});

test("Shift + Tab and the arrows walk the targets round", async ({ page }) => {
    await handle(page, "c", "source").focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await targets(page)).length).toBe(1);
    const count = Number((await targets(page))[0]?.count);
    await page.keyboard.press("Shift+Tab");
    await expect.poll(async () => (await targets(page)).length).toBe(2);
    expect((await targets(page))[1]).toMatchObject({ index: count - 1 });
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await targets(page)).length).toBe(3);
    expect((await targets(page))[2]).toMatchObject({ index: 0 });
    expect(await pointedAt(page)).toBe("c");
});

test("Escape cancels a keyboard connection, and clears nothing else", async ({
    page,
}) => {
    await node(page, "a").focus();
    await page.keyboard.press("Enter");
    await expect(node(page, "a")).toHaveAttribute("data-selected", "");
    await handle(page, "c", "source").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("root")).toHaveAttribute(
        "data-connecting",
        "",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("root")).not.toHaveAttribute(
        "data-connecting",
        "",
    );
    await expect(
        page.locator('[data-flow-part="handle"][data-valid]'),
    ).toHaveCount(0);
    expect((await documentOf(page)).edges).toHaveLength(1);
    expect((await events(page)).at(-1)).toMatchObject({
        type: "connect-cancel",
        refused: false,
        input: "keyboard",
    });
    // the Escape was the connection's: the selection stays
    await expect(node(page, "a")).toHaveAttribute("data-selected", "");
});

test("focusing a field and typing in it cancels a keyboard connection", async ({
    page,
}) => {
    await openFixture(page, "field=1");
    await handle(page, "c", "source").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("root")).toHaveAttribute(
        "data-connecting",
        "",
    );
    const field = page.getByTestId("field");
    await field.focus();
    await page.keyboard.type("x y");
    await page.keyboard.press("Enter");
    await expect(field).toHaveValue("x y");
    await expect(page.getByTestId("root")).not.toHaveAttribute(
        "data-connecting",
        "",
    );
    expect((await documentOf(page)).edges).toHaveLength(1);
    expect(
        (await events(page)).filter((event) => event.type === "connect-cancel"),
    ).toEqual([expect.objectContaining({ refused: false, input: "keyboard" })]);
});

test("a delete key removes the source node, which cancels its keyboard connection", async ({
    page,
}) => {
    await node(page, "c").focus();
    await page.keyboard.press("Enter");
    await expect(node(page, "c")).toHaveAttribute("data-selected", "");
    await handle(page, "c", "source").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("root")).toHaveAttribute(
        "data-connecting",
        "",
    );
    await page.keyboard.press("Delete");
    await expect(node(page, "c")).toHaveCount(0);
    await expect(page.getByTestId("root")).not.toHaveAttribute(
        "data-connecting",
        "",
    );
    expect((await documentOf(page)).edges).toHaveLength(1);
    expect(
        (await events(page)).filter((event) => event.type === "connect-cancel"),
    ).toEqual([expect.objectContaining({ refused: false, input: "keyboard" })]);
});

// ─── Keyboard resizing ──────────────────────────────────────────────────────
// c is 160 × 80 at (0, 200), its resizer's minimum 80 × 40; keyboard() steps by 5, Shift by 20.

const resizeHandle = (
    page: import("@playwright/test").Page,
    position: string,
) =>
    node(page, "c").locator(
        `[data-flow-part="resize-handle"][data-position="${position}"]`,
    );

test("the arrows on a focused resize handle move its sides, Shift by a bigger step", async ({
    page,
}) => {
    const right = resizeHandle(page, "right");
    await expect(right).toHaveAttribute("tabindex", "0");
    // what the page sees of each key after the engine (the window hears it last)
    await page.evaluate(() => {
        const seen: { key: string; prevented: boolean }[] = [];
        (window as unknown as { seen: typeof seen }).seen = seen;
        window.addEventListener("keydown", (event) => {
            if (event.key.startsWith("Arrow")) {
                seen.push({
                    key: event.key,
                    prevented: event.defaultPrevented,
                });
            }
        });
    });
    const seen = () =>
        page.evaluate(
            () =>
                (
                    window as unknown as {
                        seen: { key: string; prevented: boolean }[];
                    }
                ).seen,
        );
    await right.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await nodeOf(page, "c")).width).toBe(165);
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(async () => (await nodeOf(page, "c")).width).toBe(185);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => (await nodeOf(page, "c")).width).toBe(180);
    // across the side: not the resizer's, nothing changes and the key is left to the page
    await page.keyboard.press("ArrowUp");
    expect(await nodeOf(page, "c")).toMatchObject({
        width: 180,
        height: 80,
        position: { x: 0, y: 200 },
    });
    expect(await seen()).toEqual([
        { key: "ArrowRight", prevented: true },
        { key: "ArrowRight", prevented: true },
        { key: "ArrowLeft", prevented: true },
        { key: "ArrowUp", prevented: false },
    ]);
    // a corner moves both its sides
    await resizeHandle(page, "bottom-right").focus();
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await nodeOf(page, "c")).height).toBe(85);
    expect(
        (await events(page)).filter((event) => event.type === "resize").at(-1),
    ).toMatchObject({
        nodeId: "c",
        width: 180,
        height: 85,
        source: "keyboard",
    });
});

test("a keyboard resize from the left side moves the node, and the minimum holds", async ({
    page,
}) => {
    await resizeHandle(page, "left").focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(async () => (await nodeOf(page, "c")).width).toBe(80);
    expect(await nodeOf(page, "c")).toMatchObject({
        width: 80,
        position: { x: 80, y: 200 },
    });
});
