import { expect, test } from "@playwright/test";
import { openExample, part } from "../helpers";
import { boxOf, viewportOf } from "./helpers";

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
