import { expect, test } from "@playwright/test";
import { handle, node, openExample } from "../helpers";
import { dragBy, dragTo } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "announcements");
});

test("the live region says what moved, connected or was removed", async ({
    page,
}) => {
    const region = page.getByRole("status");
    await expect(region).toHaveText("Move, connect or delete a node.");
    await dragBy(page, node(page, "garden"), 40, 20);
    await expect(region).toHaveText("Moved Garden.");
    await dragTo(
        page,
        handle(page, "kitchen", "source"),
        handle(page, "garden", "target"),
    );
    await expect(region).toHaveText("Connected Kitchen to Garden.");
    // the arrows move the selection: select the hall first
    await node(page, "hall").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await expect(region).toHaveText("Moved Hall with the keyboard.");
    await page.keyboard.press("Delete");
    await expect(region).toHaveText("Removed 1 node(s) and 1 edge(s).");
    await expect(
        page.getByRole("list", { name: "Earlier" }).getByRole("listitem"),
    ).toHaveCount(3);
});
