import { expect, type Page, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, middle } from "./helpers";

// The proximity-connect example: a node dragged close to another (within a distance between their
// boxes) shows a temporary dashed edge to the closest one (`data-testid="temporary-edge"`, the
// app's own element, not a `data-flow-part="edge"`), and the drop there adds a real edge. A drop
// far from every node adds nothing.

test.beforeEach(async ({ page }) => {
    await openExample(page, "proximity-connect");
});

const temporary = (page: Page) =>
    page.getByTestId("stage").getByTestId("temporary-edge");

/** An edge by its accessible name (`<source> to <target>`). */
const named = (page: Page, name: string) =>
    page.getByTestId("stage").getByRole("group", { name, exact: true });

/** Presses a node's middle and moves it so that its top-left corner lands on a point. */
async function holdAt(page: Page, id: string, to: { x: number; y: number }) {
    const box = await boxOf(node(page, id));
    const grab = await middle(node(page, id));
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(to.x + (grab.x - box.x), to.y + (grab.y - box.y), {
        steps: 12,
    });
}

test("a node dragged near another shows a temporary edge, and the drop connects them", async ({
    page,
}) => {
    await expect(part(page, "edge")).toHaveCount(1);
    await expect(temporary(page)).toHaveCount(0);
    // Notify, held just right of Store
    const store = await boxOf(node(page, "store"));
    await holdAt(page, "notify", { x: store.x + store.width + 16, y: store.y });
    await expect(temporary(page)).toHaveCount(1);
    await expect(temporary(page)).toHaveAttribute("data-source", "store");
    await expect(temporary(page)).toHaveAttribute("data-target", "notify");
    // the temporary edge is no edge of the document
    await expect(part(page, "edge")).toHaveCount(1);
    await page.mouse.up();
    await expect(temporary(page)).toHaveCount(0);
    await expect(part(page, "edge")).toHaveCount(2);
    await expect(named(page, "Store to Notify")).toHaveCount(1);
    await expect(named(page, "Store to Notify")).toHaveAttribute(
        "data-flow-part",
        "edge",
    );
});

test("a drop far from every node adds nothing", async ({ page }) => {
    const notify = await boxOf(node(page, "notify"));
    const store = await boxOf(node(page, "store"));
    // near Store first, then back away from it before the drop
    await holdAt(page, "notify", { x: store.x + store.width + 16, y: store.y });
    await expect(temporary(page)).toHaveCount(1);
    await page.mouse.move(notify.x + notify.width / 2, notify.y + 40, {
        steps: 12,
    });
    await expect(temporary(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(node(page, "notify")).not.toHaveAttribute("data-dragging");
    await expect(part(page, "edge")).toHaveCount(1);
    await expect(temporary(page)).toHaveCount(0);
});

test("two nodes already joined show no temporary edge", async ({ page }) => {
    // Fetch and Parse are joined: Fetch held just left of Parse proposes nothing
    const parse = await boxOf(node(page, "parse"));
    const fetch = await boxOf(node(page, "fetch"));
    await holdAt(page, "fetch", {
        x: parse.x - fetch.width - 16,
        y: parse.y,
    });
    await expect(node(page, "fetch")).toHaveAttribute("data-dragging", "");
    await expect(temporary(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(part(page, "edge")).toHaveCount(1);
});

test("every node and edge a keyboard reaches is named", async ({ page }) => {
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(5);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(named(page, "Fetch to Parse")).toHaveCount(1);
});
