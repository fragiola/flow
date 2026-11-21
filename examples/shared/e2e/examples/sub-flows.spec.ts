import { expect, test } from "@playwright/test";
import { node, openExample } from "../helpers";
import { boxOf, dragBy, middle, near } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "sub-flows");
});

test("a child moves with its group", async ({ page }) => {
    const ui = node(page, "ui");
    const before = await boxOf(ui);
    const title = node(page, "frontend").getByText("Frontend");
    await dragBy(page, title, 40, 30);
    const after = await boxOf(ui);
    near(after.x - before.x, 40, 2);
    near(after.y - before.y, 30, 2);
});

test("a child stays inside its group", async ({ page }) => {
    await dragBy(page, node(page, "state"), 400, 300);
    const group = await boxOf(node(page, "frontend"));
    const child = await boxOf(node(page, "state"));
    expect(child.x + child.width).toBeLessThanOrEqual(
        group.x + group.width + 1,
    );
    expect(child.y + child.height).toBeLessThanOrEqual(
        group.y + group.height + 1,
    );
});

test("a node dropped onto a group joins it", async ({ page }) => {
    const cache = node(page, "cache");
    const backend = await middle(node(page, "backend"));
    const from = await middle(cache);
    await dragBy(page, cache, backend.x - from.x, backend.y + 30 - from.y);
    // now it moves with the backend group
    const before = await boxOf(cache);
    await dragBy(page, node(page, "backend").getByText("Backend"), -30, -20);
    const after = await boxOf(cache);
    near(after.x - before.x, -30, 2);
    near(after.y - before.y, -20, 2);
});
