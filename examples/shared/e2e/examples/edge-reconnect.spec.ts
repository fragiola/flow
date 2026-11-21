import { expect, test } from "@playwright/test";
import { edge, handle, openExample, part } from "../helpers";
import { dragFrom, middle } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "edge-reconnect");
});

const anchor = (
    page: import("@playwright/test").Page,
    id: string,
    end: "source" | "target",
) =>
    edge(page, id).locator(
        `[data-flow-part="reconnect-anchor"][data-end="${end}"]`,
    );

test("an edge's end moves to another handle, keeping its id", async ({
    page,
}) => {
    const path = edge(page, "router-laptop").locator(
        '[data-flow-part="edge-path"]',
    );
    const before = await path.getAttribute("d");
    // the anchor is drawn under the node's handle (edges come before nodes): grab it beside it
    const grab = await middle(anchor(page, "router-laptop", "target"));
    const drop = await middle(handle(page, "printer", "target"));
    await dragFrom(
        page,
        { x: grab.x - 8, y: grab.y },
        drop.x - grab.x + 8,
        drop.y - grab.y,
    );
    await expect(path).not.toHaveAttribute("d", before ?? "");
    await expect(edge(page, "router-laptop")).toHaveCount(1);
    await expect(part(page, "edge")).toHaveCount(2);
    // its end is now the printer's handle: the anchor sits on it
    const end = await middle(handle(page, "printer", "target"));
    const moved = await middle(anchor(page, "router-laptop", "target"));
    expect(Math.abs(moved.x - end.x)).toBeLessThan(3);
    expect(Math.abs(moved.y - end.y)).toBeLessThan(3);
});

test("dropped nowhere, the end goes back", async ({ page }) => {
    const path = edge(page, "router-laptop").locator(
        '[data-flow-part="edge-path"]',
    );
    const before = await path.getAttribute("d");
    const anchorPoint = await middle(anchor(page, "router-laptop", "target"));
    const from = { x: anchorPoint.x - 8, y: anchorPoint.y };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 120, from.y + 150, { steps: 8 });
    await expect(part(page, "connection-line")).toBeVisible();
    await page.mouse.up();
    await expect(path).toHaveAttribute("d", before ?? "");
});

test("a locked edge has no anchors", async ({ page }) => {
    await expect(
        edge(page, "router-tv").locator('[data-flow-part="reconnect-anchor"]'),
    ).toHaveCount(0);
});
