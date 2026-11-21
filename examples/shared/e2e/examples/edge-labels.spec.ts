import { expect, test } from "@playwright/test";
import { edge, openExample, part } from "../helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "edge-labels");
});

test("labels sit on their edges: text, a status, a button", async ({
    page,
}) => {
    await expect(part(page, "edge-label")).toHaveCount(4);
    await expect(page.getByTestId("stage").getByText("on push")).toBeVisible();
    await expect(page.getByTestId("stage").getByText("failing")).toBeVisible();
});

test("the button in a label removes its edge", async ({ page }) => {
    await page
        .getByRole("button", { name: "Remove the edge from lint to deploy" })
        .click();
    await expect(edge(page, "lint-deploy")).toHaveCount(0);
    await expect(part(page, "edge")).toHaveCount(3);
});
