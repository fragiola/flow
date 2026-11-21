import { expect, test } from "@playwright/test";
import { documentOf, node, nodeOf, openFixture } from "./helpers";

// keyboard(): nodes and edges take focus; Enter selects, the arrows move, Delete removes, Escape
// clears.

test.beforeEach(async ({ page }) => {
    await openFixture(page);
});

test("Tab reaches the nodes, which carry their names", async ({ page }) => {
    await node(page, "a").focus();
    await expect(node(page, "a")).toBeFocused();
    await expect(node(page, "a")).toHaveAttribute("tabindex", "0");
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
