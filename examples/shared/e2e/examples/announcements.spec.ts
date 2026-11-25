import { expect, test } from "@playwright/test";
import { handle, node, openExample, part } from "../helpers";
import { boxOf, dragBy, dragFrom, dragTo } from "./helpers";

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
    // the live region itself says where it starts, the first target and the keys (connect-start
    // and the first connect-target come at once: a separate message would be replaced at once)
    await expect(region).toHaveText(
        /^\s*Connecting from Hall\. Target 1 of 2: (Hall|Garden)\. Tab for the next, Enter to connect, Escape to cancel\.\s*$/,
    );
    const first = (await region.textContent())
        ?.trim()
        .match(/Target 1 of 2: (\w+)\./)?.[1];
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
    await expect(region).toHaveText(
        /^\s*Connecting from Garden\. Target 1 of 3: \w+\. Tab for the next/,
    );
    await page.keyboard.press("Escape");
    await expect(region).toHaveText("Connection cancelled.");
    await expect(part(page, "edge")).toHaveCount(1);
});

test("a keyboard connection pans the target it points at into view", async ({
    page,
}) => {
    const region = page.getByRole("status");
    const root = part(page, "root");
    const output = handle(page, "hall", "source");
    // pan the view down until the garden's bottom is past the root's, the hall's output still in
    const view = await boxOf(root);
    const garden = await boxOf(node(page, "garden"));
    const below = (await boxOf(output)).y + (await boxOf(output)).height;
    const gardenBottom = garden.y + garden.height;
    const viewBottom = view.y + view.height;
    await dragFrom(
        page,
        { x: view.x + 12, y: view.y + 12 },
        0,
        viewBottom - gardenBottom + (gardenBottom - below) / 2,
    );
    const moved = await boxOf(node(page, "garden"));
    expect(moved.y + moved.height).toBeGreaterThan(viewBottom);
    await output.focus();
    await page.keyboard.press("Enter");
    await expect(region).toHaveText(/Target 1 of 2: /);
    if (!(await region.textContent())?.includes("Garden"))
        await page.keyboard.press("Tab");
    await expect(region).toHaveText(/Target \d of 2: Garden\./);
    // the garden's node is wholly inside the root again
    await expect
        .poll(async () => {
            const box = await boxOf(node(page, "garden"));
            return (
                box.y >= view.y &&
                box.x >= view.x &&
                box.y + box.height <= viewBottom &&
                box.x + box.width <= view.x + view.width
            );
        })
        .toBe(true);
    await page.keyboard.press("Enter");
    await expect(region).toHaveText(
        "Connected Hall to Garden with the keyboard.",
    );
});
