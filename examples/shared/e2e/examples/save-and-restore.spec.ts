import { expect, test } from "@playwright/test";
import { openExample, part } from "../helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "save-and-restore");
    await page.evaluate(() => localStorage.clear());
});

test("restore brings back the saved nodes, without a remount", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Add a node" }).click();
    await expect(part(page, "node")).toHaveCount(3);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("message")).toHaveText("Saved 3 nodes.");
    await page.getByRole("button", { name: "Add a node" }).click();
    await page.getByRole("button", { name: "Add a node" }).click();
    await expect(part(page, "node")).toHaveCount(5);
    const root = await part(page, "root").elementHandle();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(part(page, "node")).toHaveCount(3);
    await expect(page.getByTestId("message")).toHaveText("Restored 3 nodes.");
    // the same root element: the live model was brought to the saved document
    expect(await root?.evaluate((element) => element.isConnected)).toBe(true);
});

test("the saved flow survives a reload", async ({ page }) => {
    await page.getByRole("button", { name: "Add a node" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await page.reload();
    await expect(page.getByTestId("message")).toHaveText(
        "A saved flow is waiting.",
    );
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(part(page, "node")).toHaveCount(3);
});
