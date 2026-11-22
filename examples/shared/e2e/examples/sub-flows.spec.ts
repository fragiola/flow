import { expect, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, dragBy, middle, near } from "./helpers";

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
