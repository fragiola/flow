import { expect, test } from "@playwright/test";
import { handle, node, openExample, part } from "../helpers";
import { boxOf, dragBy, dragTo } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "undo-redo");
});

test("a drag is one step: undo puts the node back, redo moves it again", async ({
    page,
}) => {
    const undo = page.getByRole("button", { name: "Undo" });
    const redo = page.getByRole("button", { name: "Redo" });
    await expect(undo).toBeDisabled();
    const before = await boxOf(node(page, "a"));
    await dragBy(page, node(page, "a"), 90, 40);
    await expect(page.getByTestId("steps").getByRole("listitem")).toHaveCount(
        1,
    );
    await undo.click();
    await expect
        .poll(async () => (await boxOf(node(page, "a"))).x)
        .toBeCloseTo(before.x, 0);
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect
        .poll(async () => (await boxOf(node(page, "a"))).x - before.x)
        .toBeGreaterThan(80);
});

test("a connection and a deletion are steps; the shortcuts undo them", async ({
    page,
}) => {
    await dragTo(
        page,
        handle(page, "b", "source"),
        handle(page, "c", "target"),
    );
    await expect(part(page, "edge")).toHaveCount(2);
    await node(page, "c").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Delete");
    await expect(node(page, "c")).toHaveCount(0);
    await expect(part(page, "edge")).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(node(page, "c")).toHaveCount(1);
    await expect(part(page, "edge")).toHaveCount(2);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(part(page, "edge")).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(part(page, "edge")).toHaveCount(2);
});
