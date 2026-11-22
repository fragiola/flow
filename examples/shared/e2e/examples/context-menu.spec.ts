import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, dragFrom, middle } from "./helpers";

// The root's context-menu callbacks open the example's own menu, where the press was; a double
// click on a task marks it done; a right-button pan opens none.

test.beforeEach(async ({ page }) => {
    await openExample(page, "context-menu");
});

test("a right click on a task opens its menu there, whose Duplicate adds a copy", async ({
    page,
}) => {
    const at = await middle(node(page, "build"));
    await page.mouse.click(at.x, at.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Actions" });
    await expect(menu).toBeVisible();
    const box = await boxOf(menu);
    expect(Math.abs(box.x - at.x)).toBeLessThan(2);
    expect(Math.abs(box.y - at.y)).toBeLessThan(2);
    await expect(
        page.getByRole("menuitem", { name: "Mark done" }),
    ).toBeFocused();
    // the arrows walk the items, round
    await page.keyboard.press("ArrowDown");
    await expect(
        page.getByRole("menuitem", { name: "Duplicate" }),
    ).toBeFocused();
    await page.keyboard.press("End");
    await expect(
        page.getByRole("menuitem", { name: "Delete", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
        page.getByRole("menuitem", { name: "Mark done" }),
    ).toBeFocused();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(menu).toHaveCount(0);
    await expect(part(page, "node")).toHaveCount(4);
    await expect(part(page, "node").last()).toHaveText("Build copy");
});

test("a right click on the canvas adds a task where it was; Escape closes a menu", async ({
    page,
}) => {
    const root = await boxOf(part(page, "root"));
    const spot = { x: root.x + 40, y: root.y + root.height - 60 };
    await page.mouse.click(spot.x, spot.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Add a task here" }).click();
    await expect(part(page, "node")).toHaveCount(4);
    const added = await boxOf(part(page, "node").last());
    expect(Math.abs(added.x - spot.x)).toBeLessThan(3);
    expect(Math.abs(added.y - spot.y)).toBeLessThan(3);
    const ship = await middle(node(page, "ship"));
    await page.mouse.click(ship.x, ship.y, { button: "right" });
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    // focus goes back to the task it was opened on
    await expect(node(page, "ship")).toBeFocused();
    // a click on a task closes it too
    await page.mouse.click(ship.x, ship.y, { button: "right" });
    await expect(page.getByRole("menu")).toBeVisible();
    await node(page, "plan").click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    // a click on the canvas closes it too
    await page.mouse.click(ship.x, ship.y, { button: "right" });
    await page.mouse.click(spot.x + 200, spot.y);
    await expect(page.getByRole("menu")).toHaveCount(0);
});

test("several selected tasks take one menu, which deletes them all", async ({
    page,
}) => {
    await node(page, "plan").click();
    await node(page, "ship").click({ modifiers: ["Shift"] });
    const at = await middle(node(page, "ship"));
    await page.mouse.click(at.x, at.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Delete 2 tasks" }).click();
    await expect(part(page, "node")).toHaveCount(1);
    await expect(node(page, "build")).toHaveCount(1);
});

test("the menu marks a task done, as a double click does", async ({ page }) => {
    const at = await middle(node(page, "ship"));
    await page.mouse.click(at.x, at.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Mark done" }).click();
    await expect(node(page, "ship")).toHaveText("✓ Ship");
    await page.mouse.click(at.x, at.y, { button: "right" });
    await expect(
        page.getByRole("menuitem", { name: "Mark not done" }),
    ).toBeVisible();
});

test("a double click marks a task done, and a drag is no click", async ({
    page,
}) => {
    await node(page, "plan").dblclick();
    await expect(node(page, "plan")).toHaveText("✓ Plan");
    await node(page, "plan").dblclick();
    await expect(node(page, "plan")).toHaveText("Plan");
    // a drag then a click right after: no double click
    const at = await middle(node(page, "build"));
    await dragFrom(page, at, 40, 0);
    await page.mouse.click(at.x + 40, at.y);
    await expect(node(page, "build")).toHaveText("Build");
});
