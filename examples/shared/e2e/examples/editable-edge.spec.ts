import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part } from "../helpers";
import { boxOf, dragFrom, middle, viewportOf } from "./helpers";

// The editable-edge example: an edge drawn through control points kept in its data. A double click
// on the edge adds a point, dragging a point bends the edge (without panning or dragging a node),
// Delete on a focused point removes it and the arrows move it; "Route" stores an orthogonal way
// around the nodes as the points, and "Clear points" straightens the edges. Each edge says how
// many points it has (`data-points`).

test.beforeEach(async ({ page }) => {
    await openExample(page, "editable-edge");
});

type Point = { x: number; y: number };

/** The visible path of an edge. */
const pathOf = (page: Page, id: string) =>
    edge(page, id).locator('[data-flow-part="edge-path"]').last();

/** The control point `n` (from 1) of an edge, by its name. */
const pointOf = (page: Page, edgeName: string, n: number) =>
    page
        .getByTestId("stage")
        .getByRole("button", { name: `Control point ${n} of ${edgeName}` });

/** Points along an edge's drawn path, on screen, every `step` pixels of its length. */
function samples(page: Page, id: string, step = 2) {
    return pathOf(page, id).evaluate((element, every) => {
        const path = element as SVGPathElement;
        const matrix = path.getScreenCTM() ?? undefined;
        const length = path.getTotalLength();
        const points: { x: number; y: number }[] = [];
        for (let at = 0; at <= length; at += every) {
            const point = path.getPointAtLength(at);
            const screen = new DOMPoint(point.x, point.y).matrixTransform(
                matrix,
            );
            points.push({ x: screen.x, y: screen.y });
        }
        return points;
    }, step);
}

/** The points of `points` strictly inside a box (shrunk by 1 px of rounding). */
const inside = (
    points: Point[],
    box: { x: number; y: number; width: number; height: number },
) =>
    points.filter(
        (point) =>
            point.x > box.x + 1 &&
            point.x < box.x + box.width - 1 &&
            point.y > box.y + 1 &&
            point.y < box.y + box.height - 1,
    );

test("a double click adds a point, and dragging it bends the edge", async ({
    page,
}) => {
    const id = "source-target";
    await expect(edge(page, id)).toHaveAttribute("data-points", "0");
    const before = await pathOf(page, id).getAttribute("d");
    // on the edge, between the source and the firewall (which covers its middle)
    const along = await samples(page, id);
    const at = along[Math.round(along.length / 8)] as Point;
    await page.mouse.dblclick(at.x, at.y);
    await expect(edge(page, id)).toHaveAttribute("data-points", "1");
    const point = pointOf(page, "Source to Target", 1);
    await expect(point).toBeVisible();
    const added = await middle(point);
    expect(Math.hypot(added.x - at.x, added.y - at.y)).toBeLessThan(3);
    // the point is on the path still: the edge goes through it
    const bent = await pathOf(page, id).getAttribute("d");
    expect(bent).not.toBe(before);

    const viewport = await viewportOf(page);
    await dragFrom(page, added, 0, -80, { release: false });
    await expect(point).toHaveAttribute("data-dragging", "");
    await page.mouse.up();
    await expect(point).not.toHaveAttribute("data-dragging");
    const moved = await middle(point);
    expect(moved.y).toBeCloseTo(added.y - 80, -1);
    expect(moved.x).toBeCloseTo(added.x, -1);
    await expect(pathOf(page, id)).not.toHaveAttribute("d", bent ?? "");
    // neither the pane panned nor a node moved
    expect(await viewportOf(page)).toEqual(viewport);
    await expect(
        part(page, "node").and(page.locator("[data-dragging]")),
    ).toHaveCount(0);
    // the edge passes by the moved point (its corner rounded by 8 px at most)
    const through = await samples(page, id, 1);
    expect(
        Math.min(
            ...through.map((each) =>
                Math.hypot(each.x - moved.x, each.y - moved.y),
            ),
        ),
    ).toBeLessThan(8);
});

test("on a focused point, the arrows move it and Delete removes it", async ({
    page,
}) => {
    const id = "source-archive";
    await expect(edge(page, id)).toHaveAttribute("data-points", "1");
    const point = pointOf(page, "Source to Archive", 1);
    await point.focus();
    await expect(point).toBeFocused();
    const before = await pathOf(page, id).getAttribute("d");
    const start = await middle(point);
    await page.keyboard.press("ArrowRight");
    await expect(pathOf(page, id)).not.toHaveAttribute("d", before ?? "");
    expect((await middle(point)).x).toBeGreaterThan(start.x + 5);
    const moved = await pathOf(page, id).getAttribute("d");

    await page.keyboard.press("Delete");
    await expect(edge(page, id)).toHaveAttribute("data-points", "0");
    await expect(point).toHaveCount(0);
    await expect(pathOf(page, id)).not.toHaveAttribute("d", moved ?? "");
    // only the point went: both edges are there
    await expect(part(page, "edge")).toHaveCount(2);
    // Backspace too, on a point added back
    const along = await samples(page, id);
    const at = along[Math.round(along.length / 4)] as Point;
    await page.mouse.dblclick(at.x, at.y);
    await expect(edge(page, id)).toHaveAttribute("data-points", "1");
    await point.focus();
    await page.keyboard.press("Backspace");
    await expect(edge(page, id)).toHaveAttribute("data-points", "0");
    await expect(part(page, "edge")).toHaveCount(2);
});

test("Route takes the edge around the node in the way", async ({ page }) => {
    const id = "source-target";
    const firewall = await boxOf(node(page, "firewall"));
    // straight, the edge runs under the firewall
    expect(inside(await samples(page, id), firewall).length).toBeGreaterThan(0);
    await page
        .getByRole("toolbar", { name: "Edge actions" })
        .getByRole("button", { name: "Route" })
        .click();
    await expect(page.getByTestId("stage").getByRole("status")).toHaveText(
        "Routed around the nodes.",
    );
    await expect(edge(page, id)).not.toHaveAttribute("data-points", "0");
    // no part of the route is inside any node's box but where it starts and ends
    const route = await samples(page, id);
    expect(inside(route, firewall)).toEqual([]);
    expect(inside(route, await boxOf(node(page, "archive")))).toEqual([]);
    // its corners are control points, each named
    const count = Number(await edge(page, id).getAttribute("data-points"));
    for (let n = 1; n <= count; n++) {
        await expect(pointOf(page, "Source to Target", n)).toBeVisible();
    }
    expect(inside(await samples(page, "source-archive"), firewall)).toEqual([]);

    await page.getByRole("button", { name: "Clear points" }).click();
    await expect(edge(page, id)).toHaveAttribute("data-points", "0");
    await expect(edge(page, "source-archive")).toHaveAttribute(
        "data-points",
        "0",
    );
    await expect(page.getByTestId("stage").getByRole("status")).toHaveText(
        "The edges are straight.",
    );
});

test("every node, edge, point and action is named", async ({ page }) => {
    const stage = page.getByTestId("stage");
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(4);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const name of ["Source to Target", "Source to Archive"]) {
        await expect(
            stage.getByRole("group", { name, exact: true }),
        ).toHaveCount(1);
    }
    await expect(pointOf(page, "Source to Archive", 1)).toHaveAttribute(
        "aria-roledescription",
        "control point",
    );
    const actions = stage.getByRole("toolbar", { name: "Edge actions" });
    for (const name of ["Route", "Clear points"]) {
        await expect(
            actions.getByRole("button", { name, exact: true }),
        ).toBeVisible();
    }
});
