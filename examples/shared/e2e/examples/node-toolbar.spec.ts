import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, press } from "./helpers";

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

test("a second note Shift-clicked: the selection's toolbar stands below both and acts on both", async ({
    page,
}) => {
    await expect(node(page, "idea")).toHaveAttribute("data-selected", "");
    await page.keyboard.down("Shift");
    await press(page, node(page, "todo"));
    await page.keyboard.up("Shift");
    const both = page.getByRole("toolbar", { name: "2 notes: actions" });
    await expect(both).toBeVisible();
    // each note keeps its own toolbar above it
    await expect(part(page, "toolbar")).toHaveCount(3);
    const idea = await boxOf(node(page, "idea"));
    const todo = await boxOf(node(page, "todo"));
    const bar = await boxOf(both);
    expect(bar.y).toBeGreaterThanOrEqual(
        Math.max(idea.y + idea.height, todo.y + todo.height) - 1,
    );
    await both.getByRole("button", { name: "Make them purple" }).click();
    for (const name of ["Select a note", "Then use its toolbar"]) {
        await expect(
            page
                .getByRole("toolbar", { name: `${name}: actions` })
                .getByRole("button", { name: "Make it purple" }),
        ).toHaveAttribute("aria-pressed", "true");
    }
    await both.getByRole("button", { name: "Delete them" }).click();
    await expect(part(page, "node")).toHaveCount(0);
    await expect(part(page, "toolbar")).toHaveCount(0);
});

test("the selection's toolbar goes when one note is left selected", async ({
    page,
}) => {
    await page.keyboard.down("Shift");
    await press(page, node(page, "todo"));
    await page.keyboard.up("Shift");
    await expect(
        page.getByRole("toolbar", { name: "2 notes: actions" }),
    ).toBeVisible();
    await press(page, node(page, "todo"));
    await expect(
        page.getByRole("toolbar", { name: "2 notes: actions" }),
    ).toHaveCount(0);
    await expect(part(page, "toolbar")).toHaveCount(1);
});
