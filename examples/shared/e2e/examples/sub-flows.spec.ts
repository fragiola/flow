import { expect, test } from "@playwright/test";
import { node, openExample, part, requireCase } from "../helpers";
import { boxOf, dragBy, middle, near, press } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "sub-flows");
});

test("a child moves with its group", async ({ page }) => {
    const ui = node(page, "ui");
    const before = await boxOf(ui);
    const title = node(page, "frontend").getByText("Frontend");
    await dragBy(page, title, 40, 30);
    const after = await boxOf(ui);
    near(after.x - before.x, 40, 2);
    near(after.y - before.y, 30, 2);
});

test("a child stays inside its group", async ({ page }) => {
    await dragBy(page, node(page, "state"), 400, 300);
    const group = await boxOf(node(page, "frontend"));
    const child = await boxOf(node(page, "state"));
    expect(child.x + child.width).toBeLessThanOrEqual(
        group.x + group.width + 1,
    );
    expect(child.y + child.height).toBeLessThanOrEqual(
        group.y + group.height + 1,
    );
});

test("a node dropped onto a group joins it", async ({ page }) => {
    const cache = node(page, "cache");
    const backend = await middle(node(page, "backend"));
    const from = await middle(cache);
    await dragBy(page, cache, backend.x - from.x, backend.y + 30 - from.y);
    // now it moves with the backend group
    const before = await boxOf(cache);
    await dragBy(page, node(page, "backend").getByText("Backend"), -30, -20);
    const after = await boxOf(cache);
    near(after.x - before.x, -30, 2);
    near(after.y - before.y, -20, 2);
});

test("an edge between children is drawn above the groups it crosses (zIndexMode auto)", async ({
    page,
}) => {
    // two levels: the groups under the edges, the children above them
    await expect(part(page, "edges-layer")).toHaveCount(2);
    // the points of state-api inside a group's box and outside every child's: the edge is on top
    const tops = await page.evaluate(() => {
        const path = document.querySelector<SVGPathElement>(
            '[data-flow-part="edge"][data-flow-id="state-api"] [data-flow-part="edge-path"]',
        );
        const matrix = path?.getScreenCTM();
        if (!path || !matrix) return [];
        const boxes = (selector: string) =>
            [...document.querySelectorAll(selector)].map((element) =>
                element.getBoundingClientRect(),
            );
        const groups = boxes(
            '[data-flow-part="node"]:is([data-flow-id="frontend"], [data-flow-id="backend"])',
        );
        const children = boxes(
            '[data-flow-part="node"]:not([data-flow-id="frontend"], [data-flow-id="backend"])',
        );
        const inside = (box: DOMRect, x: number, y: number, margin: number) =>
            x > box.left + margin &&
            x < box.right - margin &&
            y > box.top + margin &&
            y < box.bottom - margin;
        const found: (string | null)[] = [];
        const length = path.getTotalLength();
        for (let i = 1; i < 40; i++) {
            const point = path
                .getPointAtLength((length * i) / 40)
                .matrixTransform(matrix);
            if (!groups.some((box) => inside(box, point.x, point.y, 4))) {
                continue;
            }
            if (children.some((box) => inside(box, point.x, point.y, -8))) {
                continue;
            }
            const hit = document.elementFromPoint(point.x, point.y);
            found.push(
                hit?.closest('[data-flow-part="edge"]')
                    ? "edge"
                    : (hit
                          ?.closest('[data-flow-part="node"]')
                          ?.getAttribute("data-flow-id") ?? null),
            );
        }
        return found;
    });
    expect(tops.length).toBeGreaterThan(0);
    for (const top of tops) expect(top).toBe("edge");
});

/** Selects Cache and Logs (Shift adds), then groups them; returns their boxes before. */
async function groupCacheAndLogs(page: import("@playwright/test").Page) {
    const group = page.getByRole("button", { name: "Group selection" });
    const ungroup = page.getByRole("button", { name: "Ungroup" });
    await expect(group).toBeDisabled();
    await expect(ungroup).toBeDisabled();
    await press(page, node(page, "cache"));
    await expect(node(page, "cache")).toHaveAttribute("data-selected", "");
    // one top-level node is not enough
    await expect(group).toBeDisabled();
    await page.keyboard.down("Shift");
    await press(page, node(page, "logs"));
    await page.keyboard.up("Shift");
    await expect(node(page, "logs")).toHaveAttribute("data-selected", "");
    const before = {
        cache: await boxOf(node(page, "cache")),
        logs: await boxOf(node(page, "logs")),
    };
    await group.click();
    await expect(node(page, "group-1")).toHaveCount(1);
    await expect(node(page, "group-1")).toHaveAttribute("data-measured");
    return before;
}

test("Group selection wraps the selected nodes in a new group, keeping their places", async ({
    page,
}) => {
    requireCase("sub-flows", "selection-grouping");
    const before = await groupCacheAndLogs(page);
    // the new group is selected, so it can be ungrouped at once
    await expect(node(page, "group-1")).toHaveAttribute("data-selected", "");
    await expect(page.getByRole("button", { name: "Ungroup" })).toBeEnabled();
    const box = await boxOf(node(page, "group-1"));
    for (const id of ["cache", "logs"] as const) {
        const after = await boxOf(node(page, id));
        near(after.x, before[id].x, 1);
        near(after.y, before[id].y, 1);
        expect(after.x).toBeGreaterThan(box.x);
        expect(after.y).toBeGreaterThan(box.y);
        expect(after.x + after.width).toBeLessThan(box.x + box.width);
        expect(after.y + after.height).toBeLessThan(box.y + box.height);
    }
    // the children are drawn above their new group: a press on one selects it, not the group
    await press(page, node(page, "logs"));
    await expect(node(page, "logs")).toHaveAttribute("data-selected", "");
    await expect(node(page, "group-1")).not.toHaveAttribute(
        "data-selected",
        "",
    );
    // the children move with their new group
    const cache = await boxOf(node(page, "cache"));
    await dragBy(page, node(page, "group-1").getByText("Group 1"), 30, 20);
    const moved = await boxOf(node(page, "cache"));
    near(moved.x - cache.x, 30, 2);
    near(moved.y - cache.y, 20, 2);
});

test("Ungroup puts the children back on the flow and removes the group", async ({
    page,
}) => {
    requireCase("sub-flows", "selection-grouping");
    const before = await groupCacheAndLogs(page);
    await page.getByRole("button", { name: "Ungroup" }).click();
    await expect(node(page, "group-1")).toHaveCount(0);
    for (const id of ["cache", "logs"] as const) {
        await expect(node(page, id)).toHaveCount(1);
        const after = await boxOf(node(page, id));
        near(after.x, before[id].x, 1);
        near(after.y, before[id].y, 1);
    }
    // a group of the flow ungroups too: its children stay where they are, free of it
    await press(page, node(page, "frontend").getByText("Frontend"));
    const ui = await boxOf(node(page, "ui"));
    await page.getByRole("button", { name: "Ungroup" }).click();
    await expect(node(page, "frontend")).toHaveCount(0);
    const after = await boxOf(node(page, "ui"));
    near(after.x, ui.x, 1);
    near(after.y, ui.y, 1);
});
