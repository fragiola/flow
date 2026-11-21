import { expect, test } from "@playwright/test";
import {
    center,
    documentOf,
    eventTypes,
    handle,
    mouseDrag,
    openFixture,
    touchDrag,
} from "./helpers";

// Connections from a handle, the invalid mark, and reconnecting an edge's end by its anchor.

const anchor = (
    page: import("@playwright/test").Page,
    end: "source" | "target",
) => page.locator(`[data-flow-part="reconnect-anchor"][data-end="${end}"]`);

test.beforeEach(async ({ page }) => {
    await openFixture(page);
});

test("a drag from a source handle to a target handle adds an edge", async ({
    page,
}) => {
    await mouseDrag(
        page,
        await center(handle(page, "a", "source")),
        await center(handle(page, "c", "target")),
    );
    const { edges } = await documentOf(page);
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([
        ["a", "b"],
        ["a", "c"],
    ]);
    expect(await eventTypes(page)).toEqual(["connect-start", "connect"]);
});

test("the line follows the pointer, and a handle of the same type is marked invalid", async ({
    page,
}) => {
    const from = await center(handle(page, "a", "source"));
    const to = await center(handle(page, "c", "source"));
    await mouseDrag(page, from, to, { release: false });
    await expect(
        page.locator('[data-flow-part="connection-line"]'),
    ).toBeVisible();
    await expect(page.locator('[data-flow-part="root"]')).toHaveAttribute(
        "data-connecting",
        "",
    );
    // strict mode: a source joins a target only
    await expect(handle(page, "c", "source")).not.toHaveAttribute(
        "data-valid",
        "",
    );
    await page.mouse.move(
        ...(Object.values(await center(handle(page, "c", "target"))) as [
            number,
            number,
        ]),
        { steps: 4 },
    );
    await expect(handle(page, "c", "target")).toHaveAttribute("data-valid", "");
    await page.mouse.up();
    expect((await documentOf(page)).edges).toHaveLength(2);
});

test("an existing connection is refused and marked invalid", async ({
    page,
}) => {
    const from = await center(handle(page, "a", "source"));
    await mouseDrag(page, from, await center(handle(page, "b", "target")), {
        release: false,
    });
    await expect(handle(page, "b", "target")).toHaveAttribute(
        "data-invalid",
        "",
    );
    await page.mouse.up();
    expect((await documentOf(page)).edges).toHaveLength(1);
    expect(await eventTypes(page)).toContain("connect-cancel");
});

test("an edge's end is dragged to another handle", async ({ page }) => {
    // the anchor lies under b's handle (edges are drawn before nodes): grab it just beside
    const end = await center(anchor(page, "target"));
    await mouseDrag(
        page,
        { x: end.x - 7, y: end.y - 5 },
        await center(handle(page, "c", "target")),
    );
    const [edge] = (await documentOf(page)).edges;
    expect(edge).toMatchObject({ id: "ab", source: "a", target: "c" });
    expect(await eventTypes(page)).toEqual(["reconnect-start", "reconnect"]);
});

test.describe("touch", () => {
    test.use({ hasTouch: true });

    test("a finger connects two handles", async ({ page }) => {
        await touchDrag(
            page,
            await center(handle(page, "b", "source")),
            await center(handle(page, "c", "target")),
        );
        await expect
            .poll(async () => (await documentOf(page)).edges)
            .toHaveLength(2);
    });

    test("a finger reconnects an edge's end, grabbing its stroke near the end", async ({
        page,
    }) => {
        // a finger beside a handle lands on the handle (Chromium's touch adjustment), so it grabs
        // the stroke 20 px from the end, within the fixture's reconnection({ radius: 30 })
        const near = await page
            .locator('[data-flow-part="edge-path"]')
            .evaluate((path: SVGPathElement) => {
                const point = path.getPointAtLength(path.getTotalLength() - 20);
                const matrix = path.getScreenCTM();
                return {
                    x: point.x * (matrix?.a ?? 1) + (matrix?.e ?? 0),
                    y: point.y * (matrix?.d ?? 1) + (matrix?.f ?? 0),
                };
            });
        await touchDrag(page, near, await center(handle(page, "d", "target")));
        await expect
            .poll(async () => (await documentOf(page)).edges[0]?.target)
            .toBe("d");
    });
});
