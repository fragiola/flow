import { expect, test } from "@playwright/test";
import { handle, node, openExample, part } from "../helpers";
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

test("a keyboard connection is announced step by step", async ({ page }) => {
    const region = page.getByRole("status");
    // hall → kitchen exists: the targets are the hall's own input and the garden's
    await handle(page, "hall", "source").focus();
    await page.keyboard.press("Enter");
    await expect(region).toHaveText(/Target 1 of 2: (Hall|Garden)\./);
    await expect(
        page
            .getByRole("list", { name: "Earlier" })
            .getByRole("listitem")
            .first(),
    ).toHaveText(
        "Connecting from Hall. Tab to choose a target, Enter to connect, Escape to cancel.",
    );
    const first = (await region.textContent())?.trim().match(/: (\w+)\.$/)?.[1];
    await page.keyboard.press("Tab");
    await expect(region).toHaveText(/Target 2 of 2: /);
    const second = (await region.textContent())
        ?.trim()
        .match(/: (\w+)\.$/)?.[1];
    expect(second).not.toBe(first);
    // round the list: back to the first
    await page.keyboard.press("Tab");
    await expect(region).toHaveText(`Target 1 of 2: ${first}.`);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(region).toHaveText(
        `Connected Hall to ${second} with the keyboard.`,
    );
    await expect(part(page, "edge")).toHaveCount(2);
});

test("Escape cancels a keyboard connection, and says so", async ({ page }) => {
    const region = page.getByRole("status");
    await handle(page, "garden", "source").focus();
    await page.keyboard.press("Enter");
    await expect(region).toHaveText(/Target 1 of \d+: /);
    await page.keyboard.press("Escape");
    await expect(region).toHaveText("Connection cancelled.");
    await expect(part(page, "edge")).toHaveCount(1);
});
