import { expect, test } from "@playwright/test";
import { edge, handle, node, openExample, part } from "../helpers";
import { boxOf, dragFrom, press } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "selection-and-keyboard");
});

const status = (page: import("@playwright/test").Page) =>
    page.getByTestId("selection");

test("a click selects, Shift adds, a click on the canvas clears", async ({
    page,
}) => {
    await press(page, node(page, "design"));
    await expect(status(page)).toHaveText("1 nodes, 0 edges selected: Design");
    await page.keyboard.down("Shift");
    await press(page, node(page, "build"));
    await page.keyboard.up("Shift");
    await expect(status(page)).toHaveText(
        "2 nodes, 0 edges selected: Design, Build",
    );
    const root = await boxOf(part(page, "root"));
    await page.mouse.click(root.x + root.width - 20, root.y + root.height - 20);
    await expect(status(page)).toHaveText("Nothing selected");
});

test("Shift and a drag on the canvas draw a selection box", async ({
    page,
}) => {
    const docs = await boxOf(node(page, "docs"));
    const ship = await boxOf(node(page, "ship"));
    const from = { x: docs.x - 15, y: docs.y - 15 };
    await dragFrom(
        page,
        from,
        ship.x + ship.width + 15 - from.x,
        ship.y + ship.height + 15 - from.y,
    );
    // without Shift that was a pan: nothing selected
    await expect(status(page)).toHaveText("Nothing selected");
    const docs2 = await boxOf(node(page, "docs"));
    const ship2 = await boxOf(node(page, "ship"));
    const start = { x: docs2.x - 15, y: docs2.y - 15 };
    await page.keyboard.down("Shift");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(
        ship2.x + ship2.width + 15,
        ship2.y + ship2.height + 15,
        { steps: 8 },
    );
    await expect(part(page, "selection-box")).toBeVisible();
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await expect(status(page)).toContainText("2 nodes");
    await expect(node(page, "docs")).toHaveAttribute("data-selected", "");
    await expect(node(page, "ship")).toHaveAttribute("data-selected", "");
});

test("Tab focuses a node, the arrows move it, Delete removes it with its edges", async ({
    page,
}) => {
    const design = node(page, "design");
    await design.focus();
    await expect(design).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(design).toHaveAttribute("data-selected", "");
    const before = await boxOf(design);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const after = await boxOf(design);
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeGreaterThan(before.y);
    await page.keyboard.press("Delete");
    await expect(node(page, "design")).toHaveCount(0);
    await expect(edge(page, "design-build")).toHaveCount(0);
});

test("Tab reaches the nodes and the edges, each with its name", async ({
    page,
}) => {
    await expect(
        page.getByRole("group", { name: "Design", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("group", { name: "build to docs" }),
    ).toHaveCount(1);
    await node(page, "design").focus();
    // a node's handles follow it (keyboard() with connection()), then the next node or edge
    await page.keyboard.press("Tab");
    await expect(handle(page, "design", "target")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(handle(page, "design", "source")).toBeFocused();
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("data-flow-part", /node|edge/);
});

test("Escape clears the selection", async ({ page }) => {
    await press(page, node(page, "review"));
    await expect(status(page)).toContainText("Review");
    await node(page, "review").focus();
    await page.keyboard.press("Escape");
    await expect(status(page)).toHaveText("Nothing selected");
});

/** The label of the node whose handle a keyboard connection points at (`data-valid`). */
async function pointedAt(page: import("@playwright/test").Page) {
    const valid = page
        .getByTestId("stage")
        .locator('[data-flow-part="handle"][data-valid]');
    await expect(valid).toHaveCount(1);
    return (await valid.getAttribute("aria-label"))?.replace(/ input$/, "");
}

test("Enter on a handle starts a connection, Tab picks the target, Enter draws the edge", async ({
    page,
}) => {
    const output = handle(page, "docs", "source");
    await output.focus();
    await expect(output).toHaveAccessibleName("Docs output");
    await page.keyboard.press("Enter");
    await expect(part(page, "root")).toHaveAttribute("data-connecting", "");
    await expect(part(page, "connection-line")).toHaveCount(1);
    const first = await pointedAt(page);
    await page.keyboard.press("Tab");
    await expect(output).toBeFocused();
    const target = await pointedAt(page);
    expect(target).not.toBe(first);
    await page.keyboard.press("Enter");
    await expect(part(page, "root")).not.toHaveAttribute("data-connecting", "");
    await expect(part(page, "edge")).toHaveCount(6);
    await expect(
        page.getByRole("group", {
            name: `docs to ${target?.toLowerCase()}`,
            exact: true,
        }),
    ).toHaveCount(1);
});

test("Escape cancels a keyboard connection", async ({ page }) => {
    await handle(page, "docs", "source").focus();
    await page.keyboard.press("Enter");
    await expect(part(page, "root")).toHaveAttribute("data-connecting", "");
    await page.keyboard.press("Escape");
    await expect(part(page, "root")).not.toHaveAttribute("data-connecting", "");
    await expect(
        page
            .getByTestId("stage")
            .locator('[data-flow-part="handle"][data-valid]'),
    ).toHaveCount(0);
    await expect(part(page, "edge")).toHaveCount(5);
});
