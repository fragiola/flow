import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part } from "../helpers";
import { boxOf, near, press, viewportOf } from "./helpers";

// The copy-paste example: Ctrl/⌘ + C copies the selected nodes and the edges between them, Ctrl/⌘
// + X cuts them, Ctrl/⌘ + V pastes them with new ids (a copy of `idea` is `idea-2`, then
// `idea-3`), selected, under the pointer when it is over the flow and one step (24 flow units)
// further on each paste at the same place; the toolbar's Copy, Cut and Paste do the same, the
// paste one step from where the nodes were copied. The spec never needs the system clipboard: the
// example keeps its own copy in memory when the browser refuses to read it. Idea → Sketch → Build,
// in a row.

test.beforeEach(async ({ page }) => {
    await openExample(page, "copy-paste");
});

const stage = (page: Page) => page.getByTestId("stage");
const message = (page: Page) => stage(page).getByTestId("message");
const button = (page: Page, name: string) =>
    stage(page).getByRole("button", { name, exact: true });

/** Selects nodes by clicking the first and Shift-clicking the others. */
async function select(page: Page, ...ids: string[]) {
    for (const [index, id] of ids.entries()) {
        if (index > 0) await page.keyboard.down("Shift");
        await press(page, node(page, id));
        if (index > 0) await page.keyboard.up("Shift");
        await expect(node(page, id)).toHaveAttribute("data-selected", "");
    }
}

/** A point of the flow's empty canvas, under the nodes. */
async function emptyPoint(page: Page) {
    const root = await boxOf(part(page, "root").first());
    return { x: root.x + root.width / 2, y: root.y + root.height * 0.75 };
}

test("copy then paste adds the selected nodes and only the edges between them, with new ids, under the pointer", async ({
    page,
}) => {
    await select(page, "idea", "sketch");
    await page.keyboard.press("ControlOrMeta+c");
    await expect(message(page)).toHaveText("Copied 2 nodes and 1 edge.");
    const at = await emptyPoint(page);
    await page.mouse.move(at.x, at.y);
    await page.keyboard.press("ControlOrMeta+v");
    await expect(message(page)).toHaveText("Pasted 2 nodes and 1 edge.");
    await expect(part(page, "node")).toHaveCount(5);
    await expect(part(page, "edge")).toHaveCount(3);
    await expect(node(page, "idea-2")).toHaveAccessibleName("Idea");
    await expect(node(page, "sketch-2")).toHaveAccessibleName("Sketch");
    // the edge between the copies, and none to Build
    await expect(edge(page, "idea-sketch-2")).toHaveAccessibleName(
        "Idea to Sketch",
    );
    await expect(edge(page, "sketch-build-2")).toHaveCount(0);
    // the copies are the selection now
    await expect(node(page, "idea-2")).toHaveAttribute("data-selected", "");
    await expect(node(page, "sketch-2")).toHaveAttribute("data-selected", "");
    await expect(node(page, "idea")).not.toHaveAttribute("data-selected");
    await expect(node(page, "sketch")).not.toHaveAttribute("data-selected");
    // the copies' top-left corner on the pointer
    const first = await boxOf(node(page, "idea-2"));
    near(first.x, at.x);
    near(first.y, at.y);

    // a second paste at the same place goes one step further, with new ids again
    await page.keyboard.press("ControlOrMeta+v");
    await expect(part(page, "node")).toHaveCount(7);
    await expect(part(page, "edge")).toHaveCount(4);
    await expect(edge(page, "idea-sketch-3")).toHaveCount(1);
    await expect(node(page, "idea-3")).toHaveAttribute("data-selected", "");
    await expect(node(page, "idea-2")).not.toHaveAttribute("data-selected");
    const { zoom } = await viewportOf(page);
    const second = await boxOf(node(page, "idea-3"));
    near(second.x - first.x, 24 * zoom);
    near(second.y - first.y, 24 * zoom);
});

test("cut removes the selected nodes and their edges, and paste brings them back", async ({
    page,
}) => {
    await select(page, "idea", "sketch");
    await page.keyboard.press("ControlOrMeta+x");
    await expect(message(page)).toHaveText("Cut 2 nodes and 1 edge.");
    await expect(part(page, "node")).toHaveCount(1);
    await expect(node(page, "build")).toHaveCount(1);
    await expect(part(page, "edge")).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+v");
    await expect(message(page)).toHaveText("Pasted 2 nodes and 1 edge.");
    await expect(part(page, "node")).toHaveCount(3);
    await expect(part(page, "edge")).toHaveCount(1);
    await expect(node(page, "idea-2")).toHaveAccessibleName("Idea");
    await expect(node(page, "sketch-2")).toHaveAccessibleName("Sketch");
    await expect(edge(page, "idea-sketch-2")).toHaveAccessibleName(
        "Idea to Sketch",
    );
});

test("the toolbar's buttons copy, cut and paste", async ({ page }) => {
    await expect(button(page, "Copy")).toBeDisabled();
    await expect(button(page, "Cut")).toBeDisabled();
    await select(page, "build");
    await expect(button(page, "Copy")).toBeEnabled();
    const original = await boxOf(node(page, "build"));
    await button(page, "Copy").click();
    await expect(message(page)).toHaveText("Copied 1 node and 0 edges.");
    await button(page, "Paste").click();
    await expect(message(page)).toHaveText("Pasted 1 node and 0 edges.");
    await expect(node(page, "build-2")).toHaveAttribute("data-selected", "");
    // a button's paste: one step from where the node was copied
    const { zoom } = await viewportOf(page);
    const copy = await boxOf(node(page, "build-2"));
    near(copy.x - original.x, 24 * zoom);
    near(copy.y - original.y, 24 * zoom);

    // cut the pasted copy (the selection), and paste it back where it was
    await button(page, "Cut").click();
    await expect(message(page)).toHaveText("Cut 1 node and 0 edges.");
    await expect(node(page, "build-2")).toHaveCount(0);
    await expect(button(page, "Cut")).toBeDisabled();
    await button(page, "Paste").click();
    await expect(node(page, "build-2")).toHaveCount(1);
    const back = await boxOf(node(page, "build-2"));
    near(back.x, copy.x);
    near(back.y, copy.y);
    await expect(part(page, "node")).toHaveCount(4);
});

test("every node, edge and control is named", async ({ page }) => {
    await expect(
        page.getByRole("group", { name: "Copy and paste", exact: true }),
    ).toHaveCount(1);
    await expect(
        stage(page).getByRole("toolbar", { name: "Clipboard", exact: true }),
    ).toHaveCount(1);
    for (const name of ["Copy", "Cut", "Paste"])
        await expect(button(page, name)).toHaveCount(1);
    await expect(stage(page).getByRole("status")).toHaveCount(1);
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(3);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    const edges = part(page, "edge");
    await expect(edges).toHaveCount(2);
    for (const element of await edges.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(
        stage(page).getByRole("group", {
            name: "Sketch to Build",
            exact: true,
        }),
    ).toHaveCount(1);
});
