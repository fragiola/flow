import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part } from "../helpers";
import { boxOf, middle } from "./helpers";

// The intersections example: while a node is dragged, the nodes it overlaps and the edges whose
// path crosses it (not its own edges) carry `data-intersecting`; the drop clears it. With the
// "Resolve collisions" switch on, the drop pushes the overlapped nodes away: no two nodes overlap
// after it, and the dropped node stays where it was dropped.

test.beforeEach(async ({ page }) => {
    await openExample(page, "intersections");
});

const stage = (page: Page) => page.getByTestId("stage");

/** An edge by its accessible name (`<source> to <target>`). */
const named = (page: Page, name: string) =>
    stage(page).getByRole("group", { name, exact: true });

/** Presses a node's middle and moves it so that its centre lands on a point. */
async function holdAt(page: Page, id: string, to: { x: number; y: number }) {
    const grab = await middle(node(page, id));
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
}

type Box = { x: number; y: number; width: number; height: number };

const overlap = (a: Box, b: Box) =>
    Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
    Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);

/** The pairs of nodes (by id) whose boxes on screen overlap. */
async function overlaps(page: Page): Promise<string[]> {
    const boxes: { id: string; box: Box }[] = [];
    for (const element of await part(page, "node").all()) {
        const id = (await element.getAttribute("data-flow-id")) ?? "";
        boxes.push({ id, box: await boxOf(element) });
    }
    const pairs: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i] as { id: string; box: Box };
            const b = boxes[j] as { id: string; box: Box };
            if (overlap(a.box, b.box)) pairs.push(`${a.id}+${b.id}`);
        }
    }
    return pairs;
}

test("a node dragged over another marks it, and the drop clears the mark", async ({
    page,
}) => {
    await expect(stage(page).locator("[data-intersecting]")).toHaveCount(0);
    const parse = await middle(node(page, "parse"));
    // Notify, held over Parse (a little off its centre)
    await holdAt(page, "notify", { x: parse.x + 20, y: parse.y + 10 });
    await expect(node(page, "notify")).toHaveAttribute("data-dragging", "");
    await expect(node(page, "parse")).toHaveAttribute("data-intersecting", "");
    // the dragged node itself, and the nodes it does not touch, are not marked
    await expect(node(page, "notify")).not.toHaveAttribute("data-intersecting");
    await expect(node(page, "log")).not.toHaveAttribute("data-intersecting");
    await page.mouse.up();
    await expect(node(page, "notify")).not.toHaveAttribute("data-dragging");
    await expect(stage(page).locator("[data-intersecting]")).toHaveCount(0);
    // the switch is off: the nodes still overlap
    expect(await overlaps(page)).toContain("parse+notify");
});

test("an edge whose path a dragged node crosses is marked, not the node's own edges", async ({
    page,
}) => {
    // Parse, held over the middle of the straight Fetch to Store edge, between the two nodes
    const across = await middle(edge(page, "fetch-store"));
    await holdAt(page, "parse", across);
    await expect(node(page, "parse")).toHaveAttribute("data-dragging", "");
    await expect(edge(page, "fetch-store")).toHaveAttribute(
        "data-intersecting",
        "",
    );
    // its own edge (Parse to Index) and an edge it does not reach stay unmarked
    await expect(edge(page, "parse-index")).not.toHaveAttribute(
        "data-intersecting",
    );
    await expect(edge(page, "notify-log")).not.toHaveAttribute(
        "data-intersecting",
    );
    // and no node is under it
    await expect(
        part(page, "node").and(stage(page).locator("[data-intersecting]")),
    ).toHaveCount(0);
    await page.mouse.up();
    await expect(node(page, "parse")).not.toHaveAttribute("data-dragging");
    await expect(stage(page).locator("[data-intersecting]")).toHaveCount(0);
});

test("with Resolve collisions on, the drop leaves no overlap and the dropped node in place", async ({
    page,
}) => {
    const toggle = stage(page).getByRole("switch", {
        name: "Resolve collisions",
    });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expect(toggle).toBeChecked();
    const parseBefore = await boxOf(node(page, "parse"));
    const parse = await middle(node(page, "parse"));
    await holdAt(page, "notify", { x: parse.x + 20, y: parse.y + 10 });
    await expect(node(page, "parse")).toHaveAttribute("data-intersecting", "");
    const dropped = await boxOf(node(page, "notify"));
    await page.mouse.up();
    await expect(node(page, "notify")).not.toHaveAttribute("data-dragging");
    await expect(stage(page).locator("[data-intersecting]")).toHaveCount(0);
    await expect.poll(() => overlaps(page)).toEqual([]);
    // the dropped node stayed; Parse made room
    const after = await boxOf(node(page, "notify"));
    expect(Math.abs(after.x - dropped.x)).toBeLessThan(1.5);
    expect(Math.abs(after.y - dropped.y)).toBeLessThan(1.5);
    const parseAfter = await boxOf(node(page, "parse"));
    expect(
        Math.abs(parseAfter.x - parseBefore.x) +
            Math.abs(parseAfter.y - parseBefore.y),
    ).toBeGreaterThan(1);
});

test("every node and edge a keyboard reaches is named", async ({ page }) => {
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(6);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    const edges = part(page, "edge");
    await expect(edges).toHaveCount(3);
    for (const element of await edges.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(named(page, "Fetch to Store")).toHaveAttribute(
        "data-flow-id",
        "fetch-store",
    );
});
