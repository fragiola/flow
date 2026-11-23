import { expect, type Page, test } from "@playwright/test";
import { edge, handle, node, openExample, part } from "../helpers";
import { boxOf, expectNamedHandles, middle } from "./helpers";

// The easy-connect example: a node's border is its source handle and the whole node its target
// (`connection({ mode: "loose" })`, handles as large as the node). A drag from a border onto
// another node's body connects them, and so do two taps (`clickToConnect`): the first starts a
// connection that follows the pointer (`data-connecting` on the root), the second ends it.

test.beforeEach(async ({ page }) => {
    await openExample(page, "easy-connect");
});

/** A point on a node's border: just inside its left side, on the source ring. */
async function borderOf(page: Page, id: string) {
    const box = await boxOf(node(page, id));
    return { x: box.x + 1, y: box.y + box.height / 2 };
}

/** An edge by its accessible name (`<source> to <target>`). */
const named = (page: Page, name: string) =>
    page.getByTestId("stage").getByRole("group", { name, exact: true });

test("a drag from a node's border onto another node's body connects them", async ({
    page,
}) => {
    await expect(part(page, "edge")).toHaveCount(1);
    const from = await borderOf(page, "test");
    const to = await middle(node(page, "ship"));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    // the whole of Ship takes it: its handles sit at its centre, one is marked valid
    await expect(
        node(page, "ship").locator('[data-flow-part="handle"][data-valid]'),
    ).toHaveCount(1);
    await expect(part(page, "connection-line")).toHaveAttribute(
        "data-valid",
        "",
    );
    await page.mouse.up();
    await expect(part(page, "edge")).toHaveCount(2);
    await expect(named(page, "Test to Ship")).toHaveCount(1);
    // the node was not dragged: a press on the border connects
    await expect(node(page, "test")).not.toHaveAttribute("data-dragging");
});

test("a drag from a node's body moves it and connects nothing", async ({
    page,
}) => {
    const before = await boxOf(node(page, "build"));
    const from = await middle(node(page, "build"));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 60, { steps: 10 });
    await page.mouse.up();
    await expect
        .poll(async () => (await boxOf(node(page, "build"))).y)
        .toBeGreaterThan(before.y + 30);
    await expect(part(page, "edge")).toHaveCount(1);
});

test("a tap on a node's border, then a tap on another node, connects them", async ({
    page,
}) => {
    const root = part(page, "root");
    const from = await borderOf(page, "build");
    await page.mouse.click(from.x, from.y);
    // the connection follows the pointer, with no button held
    await expect(root).toHaveAttribute("data-connecting", "");
    await expect(handle(page, "build", "source")).toHaveAttribute(
        "data-connecting",
        "",
    );
    const to = await middle(node(page, "ship"));
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await expect(
        node(page, "ship").locator('[data-flow-part="handle"][data-valid]'),
    ).toHaveCount(1);
    await page.mouse.click(to.x, to.y);
    await expect(root).not.toHaveAttribute("data-connecting");
    await expect(part(page, "edge")).toHaveCount(2);
    await expect(named(page, "Build to Ship")).toHaveCount(1);
});

test("a tap elsewhere, or Escape, cancels a tapped connection; a node never connects to itself", async ({
    page,
}) => {
    const root = part(page, "root");
    const from = await borderOf(page, "idea");
    // a tap on the empty pane cancels it
    await page.mouse.click(from.x, from.y);
    await expect(root).toHaveAttribute("data-connecting", "");
    const pane = await boxOf(page.getByTestId("stage"));
    await page.mouse.click(pane.x + 12, pane.y + pane.height - 60);
    await expect(root).not.toHaveAttribute("data-connecting");
    // Escape cancels it too
    await page.mouse.click(from.x, from.y);
    await expect(root).toHaveAttribute("data-connecting", "");
    await page.keyboard.press("Escape");
    await expect(root).not.toHaveAttribute("data-connecting");
    // a tap on its own body is refused
    await page.mouse.click(from.x, from.y);
    await expect(root).toHaveAttribute("data-connecting", "");
    const own = await middle(node(page, "idea"));
    await page.mouse.move(own.x, own.y, { steps: 5 });
    await expect(part(page, "connection-line")).toHaveAttribute(
        "data-invalid",
        "",
    );
    await page.mouse.click(own.x, own.y);
    await expect(root).not.toHaveAttribute("data-connecting");
    await expect(part(page, "edge")).toHaveCount(1);
});

test("an edge is drawn from border to border", async ({ page }) => {
    const path = edge(page, "idea-sketch")
        .locator('[data-flow-part="edge-path"]')
        .last();
    const line = await boxOf(path);
    const idea = await boxOf(node(page, "idea"));
    const sketch = await boxOf(node(page, "sketch"));
    // it starts at Idea's right side and ends at Sketch's left one, never inside either
    expect(Math.abs(line.x - (idea.x + idea.width))).toBeLessThan(3);
    expect(Math.abs(line.x + line.width - sketch.x)).toBeLessThan(3);
});

test("every node, edge and handle a keyboard reaches is named", async ({
    page,
}) => {
    // the borders: a target handle starts nothing, so it takes no focus
    await expectNamedHandles(page, 5);
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(5);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(named(page, "Idea to Sketch")).toHaveCount(1);
});
