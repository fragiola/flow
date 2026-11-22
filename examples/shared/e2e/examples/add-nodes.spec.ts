import { expect, test } from "@playwright/test";
import { handle, openExample, part } from "../helpers";
import { boxOf, dragFrom, middle, viewportOf } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "add-nodes");
});

test("a click on a palette item adds a node in the middle of the view", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Task" }).click();
    await expect(part(page, "node")).toHaveCount(2);
    const added = part(page, "node").last();
    await expect(added).toHaveText("Task 1");
    const root = await boxOf(part(page, "root"));
    const box = await boxOf(added);
    expect(
        Math.abs(box.x + box.width / 2 - (root.x + root.width / 2)),
    ).toBeLessThan(60);
});

test("a dropped palette item lands under the pointer", async ({ page }) => {
    const root = await boxOf(part(page, "root"));
    const drop = { x: root.x + 300, y: root.y + 250 };
    // the browser's drag and drop, as a user's: dragstart on the item, drop on the flow
    const data = await page.evaluateHandle(() => new DataTransfer());
    await page
        .getByRole("button", { name: "Decision" })
        .dispatchEvent("dragstart", { dataTransfer: data });
    await part(page, "root").dispatchEvent("dragover", {
        dataTransfer: data,
        clientX: drop.x,
        clientY: drop.y,
    });
    await part(page, "root").dispatchEvent("drop", {
        dataTransfer: data,
        clientX: drop.x,
        clientY: drop.y,
    });
    await expect(part(page, "node")).toHaveCount(2);
    const { zoom } = await viewportOf(page);
    const box = await boxOf(part(page, "node").last());
    // the node's top-left corner is 50 × 20 flow units up and left of the point
    expect(Math.abs(box.x - (drop.x - 50 * zoom))).toBeLessThan(3);
    expect(Math.abs(box.y - (drop.y - 20 * zoom))).toBeLessThan(3);
});

test("a connection dropped on the canvas adds a task there, joined to it", async ({
    page,
}) => {
    const from = await middle(handle(page, "first", "source"));
    await dragFrom(page, from, 120, 180);
    await expect(part(page, "node")).toHaveCount(2);
    const added = part(page, "node").last();
    await expect(added).toHaveText("Task 1");
    await expect(part(page, "edge")).toHaveCount(1);
    const { zoom } = await viewportOf(page);
    const box = await boxOf(added);
    // its top edge's middle is where the connection was dropped
    expect(Math.abs(box.x + 50 * zoom - (from.x + 120))).toBeLessThan(3);
    expect(Math.abs(box.y - (from.y + 180))).toBeLessThan(3);
});
