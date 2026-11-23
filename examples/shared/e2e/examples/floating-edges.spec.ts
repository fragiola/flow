import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part } from "../helpers";
import { boxOf, dragFrom, middle } from "./helpers";

// The floating-edges example: edges with no handles. Each edge's path starts and ends on its
// nodes' borders (a box, or the ellipse of a round node) where the line between their centres
// leaves them, and follows a node while it is dragged; "Simple" joins the middles of the nearest
// sides instead. A radio group picks the variant, and each edge says its own (`data-variant`).

test.beforeEach(async ({ page }) => {
    await openExample(page, "floating-edges");
});

/** The round nodes: their border is the ellipse of their box. */
const ROUND = new Set(["hub", "oval"]);

type Point = { x: number; y: number };
type Side = "top" | "right" | "bottom" | "left";

/** The visible path of an edge. */
const pathOf = (page: Page, id: string) =>
    edge(page, id).locator('[data-flow-part="edge-path"]').last();

/** Where an edge's drawn path starts and stops, on screen. */
function endsOf(page: Page, id: string) {
    return pathOf(page, id).evaluate((element) => {
        const path = element as SVGPathElement;
        const matrix = path.getScreenCTM() ?? undefined;
        const at = (length: number) => {
            const point = path.getPointAtLength(length);
            const screen = new DOMPoint(point.x, point.y).matrixTransform(
                matrix,
            );
            return { x: screen.x, y: screen.y };
        };
        return { source: at(0), target: at(path.getTotalLength()) };
    });
}

/**
 * The side of a node's border a point lies on (the side it faces, for a round node), or
 * "off" when it is not on the border.
 */
async function sideOn(page: Page, id: string, point: Point) {
    const box = await boxOf(node(page, id));
    const nx = (point.x - (box.x + box.width / 2)) / (box.width / 2);
    const ny = (point.y - (box.y + box.height / 2)) / (box.height / 2);
    const facing: Side =
        Math.abs(nx) >= Math.abs(ny)
            ? nx >= 0
                ? "right"
                : "left"
            : ny >= 0
              ? "bottom"
              : "top";
    if (ROUND.has(id)) {
        return Math.abs(Math.hypot(nx, ny) - 1) < 0.04 ? facing : "off";
    }
    // a box: on one of its sides, within it along that side (2 px of rounding)
    const near = 2;
    const within =
        point.x > box.x - near &&
        point.x < box.x + box.width + near &&
        point.y > box.y - near &&
        point.y < box.y + box.height + near;
    const distances: Record<Side, number> = {
        top: Math.abs(point.y - box.y),
        right: Math.abs(point.x - (box.x + box.width)),
        bottom: Math.abs(point.y - (box.y + box.height)),
        left: Math.abs(point.x - box.x),
    };
    const side = (Object.keys(distances) as Side[]).reduce((best, next) =>
        distances[next] < distances[best] ? next : best,
    );
    return within && distances[side] < near ? side : "off";
}

/** The sides an edge's two ends lie on, its source's then its target's. */
async function sidesOf(page: Page, id: string) {
    const [source, target] = id.split("-") as [string, string];
    const ends = await endsOf(page, id);
    return [
        await sideOn(page, source, ends.source),
        await sideOn(page, target, ends.target),
    ];
}

/** The middle of a node's side, on screen. */
async function sideMiddle(page: Page, id: string, side: Side) {
    const box = await boxOf(node(page, id));
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    return {
        top: { x: cx, y: box.y },
        right: { x: box.x + box.width, y: cy },
        bottom: { x: cx, y: box.y + box.height },
        left: { x: box.x, y: cy },
    }[side];
}

const EDGES = [
    "hub-wide",
    "hub-tall",
    "oval-hub",
    "square-hub",
    "wide-oval",
    "tall-square",
];

test("every edge starts and ends on its nodes' borders", async ({ page }) => {
    await expect(part(page, "edge")).toHaveCount(EDGES.length);
    // no handle: the edges float
    await expect(part(page, "handle")).toHaveCount(0);
    for (const id of EDGES) {
        await expect(edge(page, id)).toHaveAttribute(
            "data-variant",
            "straight",
        );
        const sides = await sidesOf(page, id);
        expect(sides, id).not.toContain("off");
    }
    // the hub (round) meets the square below its right on its curve, facing it
    expect(await sidesOf(page, "square-hub")).toEqual(["left", "right"]);
});

test("a dragged node carries its edges' ends along its border", async ({
    page,
}) => {
    const square = node(page, "square");
    const hub = await boxOf(node(page, "hub"));
    const box = await boxOf(square);
    const from = await middle(square);
    // above the hub: the edge must leave the square by its bottom and enter the hub by its top
    const to = {
        x: hub.x + hub.width / 2,
        y: hub.y - box.height * 1.2,
    };
    await dragFrom(page, from, to.x - from.x, to.y - from.y, {
        release: false,
    });
    await expect(square).toHaveAttribute("data-dragging", "");
    // while it moves, the end is on its border, on the side that now faces the hub
    await expect
        .poll(() => sidesOf(page, "square-hub"))
        .toEqual(["bottom", "top"]);
    await page.mouse.up();
    await expect(square).not.toHaveAttribute("data-dragging");
    await expect
        .poll(() => sidesOf(page, "square-hub"))
        .toEqual(["bottom", "top"]);
    // its other edge followed too
    expect(await sidesOf(page, "tall-square")).not.toContain("off");
});

test("the variant switch draws straight, bezier or simple paths", async ({
    page,
}) => {
    const group = page.getByRole("group", { name: "Edge path", exact: true });
    const straight = group.getByRole("radio", { name: "Straight" });
    const bezier = group.getByRole("radio", { name: "Bezier" });
    const simple = group.getByRole("radio", { name: "Simple" });
    await expect(straight).toBeChecked();
    const id = "hub-wide";
    const line = await pathOf(page, id).getAttribute("d");
    expect(line).toMatch(/L/);
    expect(line).not.toMatch(/C/);
    const lineEnds = await endsOf(page, id);

    await bezier.check();
    await expect(edge(page, id)).toHaveAttribute("data-variant", "bezier");
    const curve = await pathOf(page, id).getAttribute("d");
    expect(curve).toMatch(/C/);
    // the same ends, on the borders: only the path between them changed
    const curveEnds = await endsOf(page, id);
    for (const end of ["source", "target"] as const) {
        expect(curveEnds[end].x).toBeCloseTo(lineEnds[end].x, 0);
        expect(curveEnds[end].y).toBeCloseTo(lineEnds[end].y, 0);
    }
    for (const each of EDGES) {
        await expect(edge(page, each)).toHaveAttribute(
            "data-variant",
            "bezier",
        );
        expect(await sidesOf(page, each), each).not.toContain("off");
    }

    await simple.check();
    await expect(edge(page, id)).toHaveAttribute("data-variant", "simple");
    const sides = await pathOf(page, id).getAttribute("d");
    expect(sides).toMatch(/C/);
    expect(sides).not.toBe(curve);
    // the middles of the nearest sides: the hub's left, the wide box's right
    const ends = await endsOf(page, id);
    const hubLeft = await sideMiddle(page, "hub", "left");
    const wideRight = await sideMiddle(page, "wide", "right");
    expect(
        Math.hypot(ends.source.x - hubLeft.x, ends.source.y - hubLeft.y),
    ).toBeLessThan(2);
    expect(
        Math.hypot(ends.target.x - wideRight.x, ends.target.y - wideRight.y),
    ).toBeLessThan(2);

    await straight.check();
    await expect(edge(page, id)).toHaveAttribute("data-variant", "straight");
    await expect(pathOf(page, id)).toHaveAttribute("d", line ?? "");
});

test("every node, edge and control is named", async ({ page }) => {
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(5);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    const stage = page.getByTestId("stage");
    for (const name of [
        "Hub to Wide box",
        "Hub to Tall box",
        "Oval to Hub",
        "Square to Hub",
        "Wide box to Oval",
        "Tall box to Square",
    ]) {
        await expect(
            stage.getByRole("group", { name, exact: true }),
        ).toHaveCount(1);
    }
    const group = stage.getByRole("group", { name: "Edge path", exact: true });
    await expect(group.getByRole("radio")).toHaveCount(3);
    for (const name of ["Straight", "Bezier", "Simple"]) {
        await expect(group.getByRole("radio", { name })).toBeVisible();
    }
});
