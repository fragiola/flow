import { expect, test } from "@playwright/test";
import { handle, node, openExample, part } from "../helpers";
import { dragBy, dragTo } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "connected-data");
});

const total = (page: import("@playwright/test").Page) =>
    page.getByTestId("sum-total");

test("the sum reads the nodes connected into it", async ({ page }) => {
    await expect(total(page)).toHaveText("8");
    await expect(page.getByTestId("sum-sources")).toHaveText("of A + B");
});

test("it follows a value changed in a connected node, not in another", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Increase A" }).click();
    await expect(page.getByTestId("value-a")).toHaveText("4");
    await expect(total(page)).toHaveText("9");
    await page.getByRole("button", { name: "Decrease C" }).click();
    await expect(page.getByTestId("value-c")).toHaveText("7");
    await expect(total(page)).toHaveText("9");
});

test("it follows a connection made, and a drag leaves it as it is", async ({
    page,
}) => {
    await dragTo(
        page,
        handle(page, "c", "source"),
        handle(page, "sum", "target"),
    );
    await expect(part(page, "edge")).toHaveCount(3);
    await expect(page.getByTestId("sum-sources")).toHaveText("of A + B + C");
    await expect(total(page)).toHaveText("16");
    await dragBy(page, node(page, "b"), 30, 20);
    await expect(total(page)).toHaveText("16");
});
