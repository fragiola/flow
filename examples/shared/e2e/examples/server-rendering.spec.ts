import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part } from "../helpers";
import { boxOf, near, viewportOf } from "./helpers";

// The nodes declare their size and handles: the first render draws their edges before anything is
// measured, and the measured geometry draws the same ones.

/** Records, from the page's start, every `d` an edge path takes (an absent one is not drawn yet). */
async function recordPaths(page: Page) {
    await page.addInitScript(() => {
        const paths: Record<string, string[]> = {};
        const push = (element: Element, d: string | null) => {
            const id = element.getAttribute("data-flow-id");
            if (!id || !d) return;
            const values = paths[id] ?? [];
            if (values.at(-1) !== d) values.push(d);
            paths[id] = values;
        };
        const isPath = (element: Element) =>
            element.getAttribute("data-flow-part") === "edge-path";
        new MutationObserver((mutations) => {
            const touched = new Set<Element>();
            for (const mutation of mutations) {
                if (mutation.type === "attributes") {
                    const target = mutation.target as Element;
                    if (!isPath(target)) continue;
                    // a change made before this callback: its old value comes first
                    push(target, mutation.oldValue);
                    touched.add(target);
                    continue;
                }
                for (const added of mutation.addedNodes) {
                    if (!(added instanceof Element)) continue;
                    if (isPath(added)) touched.add(added);
                    for (const inner of added.querySelectorAll(
                        '[data-flow-part="edge-path"]',
                    )) {
                        touched.add(inner);
                    }
                }
            }
            for (const element of touched) {
                push(element, element.getAttribute("d"));
            }
        }).observe(document, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ["d"],
        });
        Object.assign(window, { __paths: paths });
    });
}

/** The numbers of an edge's path, in order (flow coordinates). */
async function pathNumbers(page: Page, edgeId: string) {
    const d =
        (await edge(page, edgeId)
            .locator('[data-flow-part="edge-path"]')
            .getAttribute("d")) ?? "";
    return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

test("every node has its declared size, every edge is drawn, and the flow fits at the identity viewport", async ({
    page,
}) => {
    await openExample(page, "server-rendering");
    await expect(part(page, "node")).toHaveCount(5);
    await expect(part(page, "edge-path")).toHaveCount(4);
    // the viewport the server drew: no fitView, so nothing moves once the engine is attached
    expect(await viewportOf(page)).toEqual({ x: 0, y: 0, zoom: 1 });
    const stage = await boxOf(page.getByTestId("stage"));
    for (const id of ["request", "render", "html", "hydrate", "measure"]) {
        const box = await boxOf(node(page, id));
        if (id !== "measure") {
            near(box.width, 150, 1);
            near(box.height, 56, 1);
        }
        expect(box.x, id).toBeGreaterThanOrEqual(stage.x);
        expect(box.y, id).toBeGreaterThanOrEqual(stage.y);
        expect(box.x + box.width, id).toBeLessThanOrEqual(
            stage.x + stage.width,
        );
        expect(box.y + box.height, id).toBeLessThanOrEqual(
            stage.y + stage.height,
        );
    }
});

test("the edges end at the declared handles", async ({ page }) => {
    await openExample(page, "server-rendering");
    // request's right side (190, 68) to render's left one (260, 68)
    const request = await pathNumbers(page, "request-render");
    expect(request.slice(0, 2)).toEqual([190, 68]);
    expect(request.slice(-2)).toEqual([260, 68]);
    // html's bottom (555, 96) to hydrate's top (555, 160)
    const hydrate = await pathNumbers(page, "html-hydrate");
    expect(hydrate.slice(0, 2)).toEqual([555, 96]);
    expect(hydrate.slice(-2)).toEqual([555, 160]);
});

test("a node's own origin places it by its top centre", async ({ page }) => {
    await openExample(page, "server-rendering");
    // hydrate's position is its top centre: right under html, the same width
    const html = await boxOf(node(page, "html"));
    const hydrate = await boxOf(node(page, "hydrate"));
    near(hydrate.x, html.x, 1);
    near(hydrate.x + hydrate.width / 2, html.x + html.width / 2, 1);
    expect(hydrate.y).toBeGreaterThan(html.y + html.height);
});

test("the first render draws the declared nodes' edges where the measured geometry does", async ({
    page,
}) => {
    await recordPaths(page);
    await openExample(page, "server-rendering");
    const paths = await page.evaluate(
        () =>
            (window as unknown as { __paths: Record<string, string[]> })
                .__paths,
    );
    // between nodes of a declared size and handles: one path from the first render on
    for (const id of ["request-render", "render-html", "html-hydrate"]) {
        expect(paths[id], id).toHaveLength(1);
    }
    // the edge to the node of an initial size only is drawn from the start too
    expect(paths["hydrate-measure"]?.length).toBeGreaterThanOrEqual(1);
});
