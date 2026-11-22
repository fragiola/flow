import { expect, type Page, test } from "@playwright/test";

// #39 (fixtures/layers, src/fixture/layers-fixture.tsx): the edge ab drawn above the node c it
// crosses, by zIndexMode, through a real hit test; a node placed by its own origin; and no layout
// jump: what the first render draws from the declared sizes and handles is what the measured
// geometry draws.

/** The viewport's offset: flow (x, y) is page (x + 100, y + 100). */
const OFFSET = 100;
/** Where the straight edge ab crosses c: its midpoint, c's centre. */
const CROSSING = { x: 260 + OFFSET, y: 150 + OFFSET };
/** A point of ab over no node (a quarter of the way from a). */
const ON_EDGE = { x: 160 + OFFSET, y: 105 + OFFSET };

const node = (page: Page, id: string) =>
    page.locator(`[data-flow-part="node"][data-flow-id="${id}"]`);

async function openLayers(page: Page, query = "") {
    await page.goto(`/fixtures/layers/${query ? `?${query}` : ""}`);
    await expect(page.locator('[data-flow-part="node"]')).toHaveCount(4);
    await expect(
        page.locator('[data-flow-part="node"]:not([data-measured])'),
    ).toHaveCount(0);
    await expect(page.locator('[data-flow-part="edge-path"]')).toHaveCount(1);
}

/** The part on top at a page point: `edge-path`, or `node <id>`. */
const topAt = (page: Page, at: { x: number; y: number }) =>
    page.evaluate(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        if (hit?.closest('[data-flow-part="edge-path"]')) return "edge-path";
        const found = hit?.closest('[data-flow-part="node"]');
        return found ? `node ${found.getAttribute("data-flow-id")}` : null;
    }, at);

async function selectEdge(page: Page) {
    await page.mouse.click(ON_EDGE.x, ON_EDGE.y);
    await expect(
        page.locator('[data-flow-part="edge"][data-flow-id="ab"]'),
    ).toHaveAttribute("data-selected", "");
}

test("auto (the default): a selected edge is drawn above the node it crosses", async ({
    page,
}) => {
    await openLayers(page);
    // unselected, the node is above the edge, in one level
    expect(await topAt(page, CROSSING)).toBe("node c");
    await expect(page.locator('[data-flow-part="edges-layer"]')).toHaveCount(0);
    await selectEdge(page);
    await expect.poll(() => topAt(page, CROSSING)).toBe("edge-path");
    await expect(page.locator('[data-flow-part="edges-layer"]')).toHaveCount(2);
    // deselected, it goes back under
    await page.mouse.click(700, 450);
    await expect.poll(() => topAt(page, CROSSING)).toBe("node c");
});

test("auto: an edge whose zIndex exceeds its nodes' is drawn above them", async ({
    page,
}) => {
    await openLayers(page, "edgeZ=5");
    expect(await topAt(page, CROSSING)).toBe("edge-path");
});

test("basic: a selected edge stays under the nodes", async ({ page }) => {
    await openLayers(page, "zIndexMode=basic");
    await selectEdge(page);
    expect(await topAt(page, CROSSING)).toBe("node c");
    await expect(page.locator('[data-flow-part="edges-layer"]')).toHaveCount(0);
});

test("manual: only the zIndex values count, never the selection", async ({
    page,
}) => {
    await openLayers(page, "zIndexMode=manual");
    await selectEdge(page);
    expect(await topAt(page, CROSSING)).toBe("node c");

    await openLayers(page, "zIndexMode=manual&edgeZ=5");
    expect(await topAt(page, CROSSING)).toBe("edge-path");

    await openLayers(page, "zIndexMode=manual&edgeZ=5&nodeZ=10");
    expect(await topAt(page, CROSSING)).toBe("node c");
});

test("a node's own origin places its box, over the root's nodeOrigin", async ({
    page,
}) => {
    await openLayers(page);
    // d at (600, 40), 80 × 40, origin { x: 0.5, y: 0.5 }: its box starts at (560, 20)
    const box = await node(page, "d").boundingBox();
    expect(box?.x).toBeCloseTo(560 + OFFSET, 0);
    expect(box?.y).toBeCloseTo(20 + OFFSET, 0);
    expect(box?.width).toBeCloseTo(80, 0);
    expect(box?.height).toBeCloseTo(40, 0);
    // a's box is not moved: the root's nodeOrigin is the top-left corner
    const a = await node(page, "a").boundingBox();
    expect(a?.x).toBeCloseTo(OFFSET, 0);
    expect(a?.y).toBeCloseTo(OFFSET, 0);
});

test("no layout jump: the first render's edge paths and node places are the measured ones", async ({
    page,
}) => {
    // every value an edge path's `d` and a node's `transform` ever take, from their insertion on
    // (a change made before the observer runs is read from its record's old value), and the
    // mutation batch each part first appeared in
    await page.addInitScript(() => {
        const history: Record<string, string[]> = {};
        const firstBatch: Record<string, number> = {};
        let batch = 0;
        /** The key and watched attribute of a node or an edge path, or nothing. */
        const watched = (element: Element) => {
            const part = element.getAttribute("data-flow-part");
            const id = element.getAttribute("data-flow-id");
            if (!id || (part !== "edge-path" && part !== "node")) return;
            return {
                key: `${part} ${id}`,
                attribute: part === "edge-path" ? "d" : "style",
            };
        };
        /** The value kept of an attribute: a path's `d`, a node's transform. */
        const keptValue = (attribute: string, raw: string | null) =>
            attribute === "d"
                ? (raw ?? "")
                : (/transform:\s*([^;]+)/.exec(raw ?? "")?.[1]?.trim() ?? "");
        const push = (key: string, value: string) => {
            const values = history[key] ?? [];
            if (values.at(-1) !== value) values.push(value);
            history[key] = values;
            firstBatch[key] ??= batch;
        };
        new MutationObserver((mutations) => {
            batch++;
            const touched = new Set<Element>();
            for (const mutation of mutations) {
                if (mutation.type === "attributes") {
                    const target = mutation.target as Element;
                    const part = watched(target);
                    if (part?.attribute !== mutation.attributeName) continue;
                    push(
                        part.key,
                        keptValue(part.attribute, mutation.oldValue),
                    );
                    touched.add(target);
                    continue;
                }
                for (const added of mutation.addedNodes) {
                    if (!(added instanceof Element)) continue;
                    touched.add(added);
                    for (const inner of added.querySelectorAll(
                        "[data-flow-part]",
                    )) {
                        touched.add(inner);
                    }
                }
            }
            for (const element of touched) {
                const part = watched(element);
                if (!part) continue;
                push(
                    part.key,
                    keptValue(
                        part.attribute,
                        element.getAttribute(part.attribute),
                    ),
                );
            }
        }).observe(document, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ["d", "style"],
        });
        Object.assign(window, { __layout: { history, firstBatch } });
    });
    await openLayers(page);
    const { history, firstBatch } = await page.evaluate(
        () =>
            (
                window as unknown as {
                    __layout: {
                        history: Record<string, string[]>;
                        firstBatch: Record<string, number>;
                    };
                }
            ).__layout,
    );
    // the edge was drawn with the nodes, before anything was measured
    expect(firstBatch["edge-path ab"]).toBeDefined();
    expect(firstBatch["edge-path ab"]).toBe(firstBatch["node a"]);
    // and nothing moved once measured: one value each, from the first render on
    for (const key of [
        "edge-path ab",
        "node a",
        "node b",
        "node c",
        "node d",
    ]) {
        expect(history[key], key).toHaveLength(1);
    }
    expect(history["node d"]?.[0]).toBe("translate(560px, 20px)");
    // the measured path starts at a's source handle (60, 60) and ends at b's target one (460, 240)
    const d = await page
        .locator('[data-flow-part="edge-path"]')
        .getAttribute("d");
    expect(d).toBe(history["edge-path ab"]?.[0]);
    const numbers = (d?.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(numbers.slice(0, 2)).toEqual([60, 60]);
    expect(numbers.slice(-2)).toEqual([460, 240]);
});
