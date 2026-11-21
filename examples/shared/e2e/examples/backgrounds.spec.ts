import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "backgrounds");
});

test("the pattern switches between dots, lines and crosses", async ({
    page,
}) => {
    const mark = page
        .getByTestId("pattern")
        .locator('[data-flow-part="background-mark"]');
    await expect(mark).toHaveJSProperty("tagName", "circle");
    await page.getByRole("button", { name: "Lines" }).click();
    await expect(page.getByRole("button", { name: "Lines" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(mark).toHaveJSProperty("tagName", "path");
    await page.getByRole("button", { name: "Cross" }).click();
    await expect(mark).toHaveJSProperty("tagName", "path");
});

test("the gap sizes the tile, and the coarse grid layers over it", async ({
    page,
}) => {
    const tile = page
        .getByTestId("pattern")
        .locator('[data-flow-part="background-pattern"]');
    const width = Number(await tile.getAttribute("width"));
    await page.getByRole("button", { name: "40" }).click();
    await expect
        .poll(async () => Number(await tile.getAttribute("width")))
        .toBeCloseTo((width * 40) / 24, 0);
    await expect(page.getByTestId("coarse-grid")).toBeVisible();
    await page.getByLabel("Coarse grid").uncheck();
    await expect(page.getByTestId("coarse-grid")).toHaveCount(0);
});
