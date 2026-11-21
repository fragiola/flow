import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { press } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "node-toolbar");
});

test("the toolbar shows for the selected node only", async ({ page }) => {
    await expect(part(page, "toolbar")).toHaveCount(1);
    await expect(
        page.getByRole("toolbar", { name: "Select a note: actions" }),
    ).toBeVisible();
    await press(page, node(page, "todo"));
    await expect(
        page.getByRole("toolbar", { name: "Then use its toolbar: actions" }),
    ).toBeVisible();
    await expect(
        page.getByRole("toolbar", { name: "Select a note: actions" }),
    ).toHaveCount(0);
});

test("its buttons duplicate, recolour and delete the node", async ({
    page,
}) => {
    const toolbar = page.getByRole("toolbar", {
        name: "Select a note: actions",
    });
    await toolbar.getByRole("button", { name: "Make it green" }).click();
    await expect(
        toolbar.getByRole("button", { name: "Make it green" }),
    ).toHaveAttribute("aria-pressed", "true");
    await toolbar.getByRole("button", { name: "Duplicate" }).click();
    await expect(part(page, "node")).toHaveCount(3);
    await toolbar.getByRole("button", { name: "Delete" }).click();
    await expect(node(page, "idea")).toHaveCount(0);
    await expect(part(page, "node")).toHaveCount(2);
});
