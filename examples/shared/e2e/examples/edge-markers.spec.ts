import { expect, type Page, test } from "@playwright/test";
import { edge, openExample, part } from "../helpers";

// The edge-markers example: no marker is built in, so the example defines its own SVG `<marker>`s
// and each edge's visible path (its last `edge-path`) points `marker-start` / `marker-end` at them:
// one marker per shape and tone, and one per shape for the selected state, which a selected edge
// switches to. The spec reads the computed `marker-start` / `marker-end` and checks each one names
// a `<marker>` on the page.

test.beforeEach(async ({ page }) => {
    await openExample(page, "edge-markers");
});

/** An edge's visible path: the last of its paths (the first is a wide transparent hit area). */
const visible = (page: Page, edgeId: string) =>
    edge(page, edgeId).locator('[data-flow-part="edge-path"]').last();

/** The ids an edge's path points its markers at (`null` when an end has none). */
async function markersOf(page: Page, edgeId: string) {
    return visible(page, edgeId).evaluate((element) => {
        const style = getComputedStyle(element);
        const id = (value: string) =>
            /url\("?#([^")]+)"?\)/.exec(value)?.[1] ?? null;
        return { start: id(style.markerStart), end: id(style.markerEnd) };
    });
}

/** Whether a `<marker>` of that id is on the page, with a shape inside. */
const defined = (page: Page, id: string) =>
    page.evaluate((markerId) => {
        const marker = document.getElementById(markerId);
        return (
            marker?.tagName.toLowerCase() === "marker" &&
            marker.querySelector("path") !== null
        );
    }, id);

/** A point on an edge's stroke, a quarter of its length from the source, on screen. */
async function onStroke(page: Page, edgeId: string) {
    return visible(page, edgeId).evaluate((element) => {
        const path = element as SVGPathElement;
        const point = path.getPointAtLength(path.getTotalLength() / 4);
        const matrix = path.getScreenCTM();
        const screen = matrix
            ? new DOMPoint(point.x, point.y).matrixTransform(matrix)
            : { x: Number.NaN, y: Number.NaN };
        return { x: screen.x, y: screen.y };
    });
}

const EDGES = {
    "client-gateway": { start: false, end: true },
    "gateway-auth": { start: true, end: true },
    "gateway-orders": { start: true, end: true },
    "orders-database": { start: true, end: true },
    "orders-cache": { start: false, end: true },
} as const;

test("each edge has markers at the ends it names, defined on the page", async ({
    page,
}) => {
    await expect(part(page, "edge")).toHaveCount(5);
    for (const [id, ends] of Object.entries(EDGES)) {
        const markers = await markersOf(page, id);
        for (const end of ["start", "end"] as const) {
            const marker = markers[end];
            if (!ends[end]) {
                expect(marker, `${id} ${end}`).toBeNull();
                continue;
            }
            expect(marker, `${id} ${end}`).not.toBeNull();
            expect(await defined(page, marker ?? ""), `${id} ${end}`).toBe(
                true,
            );
        }
    }
    // the same shape in two tones is two markers: each is coloured where it is defined
    const neutral = await markersOf(page, "client-gateway");
    const blue = await markersOf(page, "gateway-orders");
    expect(neutral.end).not.toBe(blue.end);
    // every marker id is unique on the page
    const ids = await page
        .locator("marker")
        .evaluateAll((markers) => markers.map((marker) => marker.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
});

test("a selected edge switches to the selected markers, and back", async ({
    page,
}) => {
    const before = await markersOf(page, "gateway-auth");
    const point = await onStroke(page, "gateway-auth");
    await page.mouse.click(point.x, point.y);
    await expect(edge(page, "gateway-auth")).toHaveAttribute(
        "data-selected",
        "",
    );
    await expect
        .poll(async () => (await markersOf(page, "gateway-auth")).end)
        .not.toBe(before.end);
    const selected = await markersOf(page, "gateway-auth");
    expect(selected.start).not.toBe(before.start);
    for (const id of [selected.start, selected.end]) {
        expect(id).not.toBeNull();
        expect(await defined(page, id ?? "")).toBe(true);
    }
    // the other edges keep their own
    const other = await markersOf(page, "orders-cache");
    expect(other.end).not.toBe(selected.end);
    // another edge selected: the first gets its tone's markers back
    const next = await onStroke(page, "orders-cache");
    await page.mouse.click(next.x, next.y);
    await expect(edge(page, "orders-cache")).toHaveAttribute(
        "data-selected",
        "",
    );
    await expect(edge(page, "gateway-auth")).not.toHaveAttribute(
        "data-selected",
    );
    await expect
        .poll(async () => markersOf(page, "gateway-auth"))
        .toEqual(before);
});

test("every node and edge is named, the edges by their ends", async ({
    page,
}) => {
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(6);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(
        page.getByTestId("stage").getByRole("group", {
            name: "Gateway to Auth: a circle at the start, an open arrow at the end",
            exact: true,
        }),
    ).toHaveCount(1);
    await expect(
        page.getByTestId("stage").getByRole("group", {
            name: "Client to Gateway: an arrow at the end",
        }),
    ).toHaveCount(1);
});
