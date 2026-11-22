import { expect, type Page, test } from "@playwright/test";
import {
    center,
    documentOf,
    eventTypes,
    handle,
    mouseDrag,
    node,
    nodeOf,
    openFixture,
    viewportOf,
} from "./helpers";

// The viewport and gesture options of Epic #26: auto-pan, animated controls, the pan buttons and
// the pan key, click-to-connect, drag handles, the node origin and the z-order of a selected node.
// The fixture's viewport starts at { x: 100, y: 100, zoom: 1 }; (700, 260) is the canvas.

const PANE = { x: 700, y: 260 };

type Sampler = { zooms: number[]; stop: boolean };

/**
 * The zooms the viewport element is drawn at, one per frame, from before `act` until the view has
 * settled: the sampler is installed (and has drawn a first frame) before `act` runs, and stops once
 * the engine's viewport stays the same across two polls and the last frame drew it.
 */
async function framesOf(page: Page, act: () => Promise<void>) {
    await page.evaluate(
        () =>
            new Promise<void>((ready) => {
                const viewport = document.querySelector(
                    '[data-flow-part="viewport"]',
                );
                const sampler: Sampler = { zooms: [], stop: false };
                (window as unknown as { sampler: Sampler }).sampler = sampler;
                const step = () => {
                    if (viewport) {
                        sampler.zooms.push(
                            new DOMMatrixReadOnly(
                                getComputedStyle(viewport).transform,
                            ).a,
                        );
                    }
                    if (sampler.zooms.length === 1) ready();
                    if (!sampler.stop) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            }),
    );
    await act();
    let last = Number.NaN;
    await expect
        .poll(async () => {
            const { zoom } = await viewportOf(page);
            const drawn = await page.evaluate(
                () =>
                    (
                        window as unknown as { sampler: Sampler }
                    ).sampler.zooms.at(-1) ?? Number.NaN,
            );
            const settled = zoom === last && Math.abs(drawn - zoom) < 1e-4;
            last = zoom;
            return settled;
        })
        .toBe(true);
    return page.evaluate(() => {
        const sampler = (window as unknown as { sampler: Sampler }).sampler;
        sampler.stop = true;
        return sampler.zooms;
    });
}

test("a node dragged to the root's edge pans the viewport, and stays under the pointer", async ({
    page,
}) => {
    await openFixture(page);
    const from = await center(node(page, "a"));
    const edge = { x: 795, y: from.y };
    await mouseDrag(page, from, edge, { release: false });
    // the pointer holds still at the edge: the engine pans on its own frames
    await expect.poll(async () => (await viewportOf(page)).x).toBeLessThan(40);
    const held = await center(node(page, "a"));
    expect(Math.abs(held.x - edge.x)).toBeLessThan(2);
    await page.mouse.up();
    const { x } = await viewportOf(page);
    // the node's flow point is the pointer's: past where the still view would put it
    expect((await nodeOf(page, "a")).position.x).toBeCloseTo(
        edge.x - x - (from.x - 100),
        0,
    );
    expect(await eventTypes(page)).toEqual(["drag-start", "nodes-move"]);
});

test("the zoom and fit-view buttons animate with a duration", async ({
    page,
}) => {
    await openFixture(page, "duration=300");
    const zooms = await framesOf(page, () =>
        page.getByRole("button", { name: "zoom in" }).click(),
    );
    const between = zooms.filter((zoom) => zoom > 1.001 && zoom < 1.199);
    expect(between.length).toBeGreaterThan(2);
    expect(zooms.at(-1)).toBeCloseTo(1.2, 5);
    expect((await viewportOf(page)).zoom).toBeCloseTo(1.2, 5);
    const fit = await framesOf(page, () =>
        page.getByRole("button", { name: "fit view" }).click(),
    );
    const end = fit.at(-1) ?? 0;
    expect(new Set(fit.map((zoom) => zoom.toFixed(4))).size).toBeGreaterThan(3);
    expect(end).not.toBeCloseTo(1.2, 2);
    // the last frame drawn is the engine's final viewport
    expect(end).toBeCloseTo((await viewportOf(page)).zoom, 4);
});

test("without a duration the buttons apply at once", async ({ page }) => {
    await openFixture(page);
    const zooms = await framesOf(page, () =>
        page.getByRole("button", { name: "zoom in" }).click(),
    );
    expect(zooms.filter((zoom) => zoom > 1.001 && zoom < 1.199)).toEqual([]);
});

test("the middle button pans when panOnDrag names it", async ({ page }) => {
    await openFixture(page, "panOnDrag=0,1");
    await page.mouse.move(PANE.x, PANE.y);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(PANE.x + 60, PANE.y + 40, { steps: 10 });
    await page.mouse.up({ button: "middle" });
    expect(await viewportOf(page)).toEqual({ x: 160, y: 140, zoom: 1 });
});

test("the middle button does not pan by default", async ({ page }) => {
    await openFixture(page);
    await page.mouse.move(PANE.x, PANE.y);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(PANE.x + 60, PANE.y + 40, { steps: 10 });
    await page.mouse.up({ button: "middle" });
    expect(await viewportOf(page)).toEqual({ x: 100, y: 100, zoom: 1 });
});

test("with Space held, a drag on a node pans and the node stays", async ({
    page,
}) => {
    await openFixture(page);
    const from = await center(node(page, "a"));
    await page.keyboard.down("Space");
    await mouseDrag(page, from, { x: from.x + 50, y: from.y + 30 });
    await page.keyboard.up("Space");
    expect(await viewportOf(page)).toEqual({ x: 150, y: 130, zoom: 1 });
    expect((await nodeOf(page, "a")).position).toEqual({ x: 0, y: 0 });
    // a key pan is no tap: nothing was selected
    await expect(node(page, "a")).not.toHaveAttribute("data-selected", "");
});

test("click-to-connect: a tap on a source handle, then on a target, draws the edge", async ({
    page,
}) => {
    await openFixture(page, "clickToConnect=1");
    const from = await center(handle(page, "a", "source"));
    await page.mouse.click(from.x, from.y);
    await expect(page.locator('[data-flow-part="root"]')).toHaveAttribute(
        "data-connecting",
        "",
    );
    // the connection line follows the pointer while it waits
    const to = await center(handle(page, "c", "target"));
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await expect(
        page.locator('[data-flow-part="connection-line"]'),
    ).toBeVisible();
    await page.mouse.click(to.x, to.y);
    await expect(page.locator('[data-flow-part="edge"]')).toHaveCount(2);
    const edges = (await documentOf(page)).edges;
    expect(edges.map((e) => [e.source, e.target])).toContainEqual(["a", "c"]);
    expect(await eventTypes(page)).toEqual(["connect-start", "connect"]);
});

test("click-to-connect: Escape cancels a waiting connection", async ({
    page,
}) => {
    await openFixture(page, "clickToConnect=1");
    const from = await center(handle(page, "a", "source"));
    await page.mouse.click(from.x, from.y);
    await expect(page.locator('[data-flow-part="root"]')).toHaveAttribute(
        "data-connecting",
        "",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-flow-part="root"]')).not.toHaveAttribute(
        "data-connecting",
        "",
    );
    await expect(page.locator('[data-flow-part="edge"]')).toHaveCount(1);
});

test("a tap on a handle connects nothing without clickToConnect", async ({
    page,
}) => {
    await openFixture(page);
    const from = await center(handle(page, "a", "source"));
    await page.mouse.click(from.x, from.y);
    await expect(page.locator('[data-flow-part="root"]')).not.toHaveAttribute(
        "data-connecting",
        "",
    );
});

test("a node with a drag handle drags from it only", async ({ page }) => {
    await openFixture(page, "dragHandle=1");
    const box = await node(page, "a").boundingBox();
    // the node's label line, above its grip: no drag, and no pan
    const label = { x: (box?.x ?? 0) + 30, y: (box?.y ?? 0) + 14 };
    await mouseDrag(page, label, { x: label.x + 50, y: label.y + 30 });
    expect((await nodeOf(page, "a")).position).toEqual({ x: 0, y: 0 });
    expect(await viewportOf(page)).toEqual({ x: 100, y: 100, zoom: 1 });
    // the press was still a tap's: it selected the node
    await page.mouse.click(label.x, label.y);
    await expect(node(page, "a")).toHaveAttribute("data-selected", "");
    const grip = await center(
        node(page, "a").locator("[data-flow-drag-handle]"),
    );
    await mouseDrag(page, grip, { x: grip.x + 50, y: grip.y + 30 });
    expect((await nodeOf(page, "a")).position).toEqual({ x: 50, y: 30 });
    // a node without a handle drags from anywhere
    const c = await center(node(page, "c"));
    await mouseDrag(page, c, { x: c.x + 20, y: c.y });
    expect((await nodeOf(page, "c")).position).toEqual({ x: 20, y: 200 });
});

test("nodeOrigin centres every node on its position", async ({ page }) => {
    await openFixture(page, "origin=0.5");
    // a at flow (0, 0) and b at (300, 0): their centres are drawn there
    for (const [id, x] of [
        ["a", 100],
        ["b", 400],
    ] as const) {
        const at = await center(node(page, id));
        expect(at.x).toBeCloseTo(x, 0);
        expect(at.y).toBeCloseTo(100, 0);
    }
    // the edge leaves a's source handle: its path starts at the handle's centre, in flow units
    const d =
        (await page
            .locator('[data-flow-part="edge-path"]')
            .first()
            .getAttribute("d")) ?? "";
    const [x, y] = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const source = await center(handle(page, "a", "source"));
    expect(Math.abs((x ?? 0) - (source.x - 100))).toBeLessThan(1.5);
    expect(Math.abs((y ?? 0) - (source.y - 100))).toBeLessThan(1.5);
    // a drag still moves the position by the pointer's distance
    const from = await center(node(page, "a"));
    await mouseDrag(page, from, { x: from.x + 40, y: from.y + 20 });
    expect((await nodeOf(page, "a")).position).toEqual({ x: 40, y: 20 });
});

test("a selected node is drawn above the nodes it overlaps", async ({
    page,
}) => {
    await openFixture(page);
    // b over a's right half: b comes later in the document, so it is drawn above
    const b = await center(node(page, "b"));
    await mouseDrag(page, b, { x: b.x - 250, y: b.y });
    const a = await node(page, "a").boundingBox();
    const overlap = {
        x: (a?.x ?? 0) + (a?.width ?? 0) - 10,
        y: (a?.y ?? 0) + 10,
    };
    const topAt = () =>
        page.evaluate(
            ({ x, y }) =>
                document
                    .elementFromPoint(x, y)
                    ?.closest('[data-flow-part="node"]')
                    ?.getAttribute("data-flow-id"),
            overlap,
        );
    await expect.poll(topAt).toBe("b");
    // select a by its uncovered left part: it rises above b
    await page.mouse.click((a?.x ?? 0) + 8, (a?.y ?? 0) + 8);
    await expect(node(page, "a")).toHaveAttribute("data-selected", "");
    await expect.poll(topAt).toBe("a");
    // deselected, it goes back under
    await page.mouse.click(PANE.x, PANE.y);
    await expect(node(page, "a")).not.toHaveAttribute("data-selected", "");
    await expect.poll(topAt).toBe("b");
});

test("the connection line from a selected node is drawn above it (the nodes' layer isolates their z-index)", async ({
    page,
}) => {
    await openFixture(page);
    const a = await node(page, "a").boundingBox();
    await page.mouse.click((a?.x ?? 0) + 8, (a?.y ?? 0) + 8);
    await expect(node(page, "a")).toHaveAttribute("data-selected", "");
    const from = await center(handle(page, "a", "source"));
    // a connection held from a's source handle (not released)
    await mouseDrag(
        page,
        from,
        { x: from.x + 120, y: from.y + 80 },
        { release: false },
    );
    await expect(
        page.locator('[data-flow-part="connection-path"]'),
    ).toHaveCount(1);
    // the line hit-testable along a wide stroke: just above the handle's centre, inside a's box,
    // the line is what is on top, not the raised node
    const top = await page.evaluate(({ x, y }) => {
        const path = document.querySelector<SVGPathElement>(
            '[data-flow-part="connection-path"]',
        );
        const line = path?.closest<SVGSVGElement>(
            '[data-flow-part="connection-line"]',
        );
        if (!path || !line) return null;
        line.style.pointerEvents = "auto";
        path.style.pointerEvents = "stroke";
        path.style.strokeWidth = "40px";
        path.style.stroke = "transparent";
        // the line's SVG or its path: either is the line, drawn above the node
        const hit = document.elementFromPoint(x, y - 8);
        return hit?.closest('[data-flow-part="connection-line"]')
            ? "connection-line"
            : (hit
                  ?.closest("[data-flow-part]")
                  ?.getAttribute("data-flow-part") ?? null);
    }, from);
    await page.mouse.up();
    expect(top).toBe("connection-line");
});
