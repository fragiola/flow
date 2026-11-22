import { expect, test } from "@playwright/test";
import { handle, node, openExample, part } from "../helpers";
import { dragTo, expectNamedHandles, press } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "workflow-builder");
});

test("opens a valid workflow: seven steps, six connections, ready", async ({
    page,
}) => {
    await expect(part(page, "node")).toHaveCount(7);
    await expect(part(page, "edge")).toHaveCount(6);
    await expect(page.getByTestId("status")).toHaveText("Ready");
    await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled();
    await expect(
        page.getByRole("img", { name: "Minimap of the workflow" }),
    ).toBeVisible();
});

test("a palette step is added, selected and shown in the inspector", async ({
    page,
}) => {
    await page
        .getByRole("navigation", { name: "Steps" })
        .getByRole("button", { name: "Post to Slack" })
        .click();
    await expect(part(page, "node")).toHaveCount(8);
    const inspector = page.getByRole("complementary", { name: "Inspector" });
    await expect(inspector.getByRole("heading")).toHaveText("Action settings");
    // a step nothing leads to is an issue
    await expect(page.getByTestId("status")).toHaveText("1 issue");
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
    await inspector.getByRole("textbox", { name: "Name" }).fill("Notify sales");
    await expect(
        page.getByRole("group", { name: "Action: Notify sales" }),
    ).toBeVisible();
});

test("the rules refuse what a workflow cannot do", async ({ page }) => {
    // an output leads to one step: the trigger already leads to the condition
    await dragTo(
        page,
        handle(page, "order", "source", "out"),
        handle(page, "follow-up", "target", "in"),
    );
    await expect(part(page, "edge")).toHaveCount(6);
    // no loop back to an earlier step
    await dragTo(
        page,
        handle(page, "follow-up", "source", "out"),
        handle(page, "big", "target", "in"),
    );
    await expect(part(page, "edge")).toHaveCount(6);
    // a free output joins a later step
    await dragTo(
        page,
        handle(page, "record", "source", "out"),
        handle(page, "follow-up", "target", "in"),
    );
    await expect(part(page, "edge")).toHaveCount(7);
});

test("removing a step shows what it leaves unconnected", async ({ page }) => {
    await press(page, node(page, "wait"));
    const inspector = page.getByRole("complementary", { name: "Inspector" });
    await expect(inspector.getByRole("heading")).toHaveText("Delay settings");
    await inspector.getByRole("button", { name: "Delete step" }).click();
    await expect(node(page, "wait")).toHaveCount(0);
    await expect(page.getByTestId("status")).toHaveText("1 issue");
    await expect(inspector.getByTestId("issues")).toContainText(
        "Ask for a review: Nothing leads to this step.",
    );
});

test("every handle a keyboard reaches has a name", async ({ page }) => {
    await expectNamedHandles(page, 6);
});
