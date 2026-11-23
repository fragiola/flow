import { expect, type Page, test } from "@playwright/test";
import { handle, node, openExample, part } from "../helpers";
import { boxIn, boxOf, nodeBoxes } from "./helpers";

// The elk-layout example: a data pipeline of 9 nodes ("Orders API" = `orders`, "Customers DB",
// "Clickstream", "Join", "Sessionize", "Enrich", "Warehouse", "Quality report", "Dashboard") and
// 10 edges (`<source>-<target>`), each between a named output (a source handle on the right) and
// a named input (a target handle on the left), laid out by ELK once opened (async). The
// "Algorithm" radio group lays it out again, "Layered" or "Tree": the root (the group
// "ELK layout") carries `data-algorithm` and `data-layout="running" | "done"`. Each node prints
// its place (`data-position="x, y"`); its handles carry their id (`data-flow-id`) and side.

const LINKS = [
    ["orders", "join"],
    ["customers", "join"],
    ["clicks", "sessions"],
    ["join", "enrich"],
    ["join", "quality"],
    ["sessions", "enrich"],
    ["sessions", "warehouse"],
    ["enrich", "warehouse"],
    ["enrich", "quality"],
    ["warehouse", "dashboard"],
] as const;

const NODES = [
    "orders",
    "customers",
    "clicks",
    "join",
    "sessions",
    "enrich",
    "warehouse",
    "quality",
    "dashboard",
] as const;

const root = (page: Page) =>
    page.getByRole("group", { name: "ELK layout", exact: true });
const algorithm = (page: Page) =>
    page.getByRole("group", { name: "Algorithm", exact: true });
const radio = (page: Page, name: "Layered" | "Tree") =>
    algorithm(page).getByRole("radio", { name, exact: true });

test.beforeEach(async ({ page }) => {
    await openExample(page, "elk-layout");
    await expect(root(page)).toHaveAttribute("data-layout", "done");
});

/** Every node's printed place. */
async function positions(page: Page) {
    return part(page, "node").evaluateAll((elements) =>
        Object.fromEntries(
            elements.map((element) => [
                element.getAttribute("data-flow-id"),
                element.getAttribute("data-position"),
            ]),
        ),
    );
}

/** Expects no two node boxes on screen to overlap. */
async function expectApart(page: Page) {
    const drawn = await nodeBoxes(page);
    const boxes = NODES.map((id) => ({ id, ...boxIn(drawn, id) }));
    for (const [index, a] of boxes.entries()) {
        for (const b of boxes.slice(index + 1)) {
            const apart =
                a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y + a.height <= b.y ||
                b.y + b.height <= a.y;
            expect(apart, `${a.id} and ${b.id} apart`).toBe(true);
        }
    }
}

/** The ids of a node's handles of a type, top to bottom on screen. */
async function handleOrder(page: Page, id: string, type: "source" | "target") {
    const handles = await handle(page, id, type).all();
    const placed = await Promise.all(
        handles.map(async (element) => ({
            id: await element.getAttribute("data-flow-id"),
            y: (await boxOf(element)).y,
        })),
    );
    return placed.sort((a, b) => a.y - b.y).map((entry) => entry.id);
}

test("opens laid out by ELK, layered: apart, every edge going right", async ({
    page,
}) => {
    await expect(root(page)).toHaveAttribute("data-algorithm", "layered");
    await expect(radio(page, "Layered")).toBeChecked();
    await expect(part(page, "node")).toHaveCount(NODES.length);
    await expect(part(page, "edge")).toHaveCount(LINKS.length);
    await expectApart(page);
    const boxes = await nodeBoxes(page);
    for (const [source, target] of LINKS) {
        const from = boxIn(boxes, source);
        const to = boxIn(boxes, target);
        expect(to.x, `${target} right of ${source}`).toBeGreaterThan(
            from.x + from.width,
        );
    }
});

test("nodes have several named handles, inputs left and outputs right, in ELK's order", async ({
    page,
}) => {
    await expect(handle(page, "join", "target")).toHaveCount(2);
    await expect(handle(page, "join", "source")).toHaveCount(2);
    await expect(handle(page, "enrich", "target")).toHaveCount(2);
    await expect(handle(page, "enrich", "source")).toHaveCount(2);
    for (const id of NODES) {
        for (const element of await handle(page, id, "target").all()) {
            await expect(element).toHaveAttribute("data-side", "left");
        }
        for (const element of await handle(page, id, "source").all()) {
            await expect(element).toHaveAttribute("data-side", "right");
        }
    }
    // the document lists Join's "customers" input above "orders"; the layout puts each input
    // level with the source that feeds it, so the higher source's input comes first
    const boxes = await nodeBoxes(page);
    const orders = boxIn(boxes, "orders");
    const customers = boxIn(boxes, "customers");
    expect(await handleOrder(page, "join", "target")).toEqual(
        orders.y < customers.y
            ? ["orders", "customers"]
            : ["customers", "orders"],
    );
});

test("Tree lays it out again with mrtree, and Layered back", async ({
    page,
}) => {
    const layered = await positions(page);
    await radio(page, "Tree").check();
    await expect(root(page)).toHaveAttribute("data-algorithm", "mrtree");
    await expect(root(page)).toHaveAttribute("data-layout", "done");
    await expect(radio(page, "Tree")).toBeChecked();
    await expect.poll(() => positions(page)).not.toEqual(layered);
    await expectApart(page);

    await radio(page, "Layered").check();
    await expect(root(page)).toHaveAttribute("data-algorithm", "layered");
    await expect(root(page)).toHaveAttribute("data-layout", "done");
    await expect.poll(() => positions(page)).toEqual(layered);
});

test("every control, node and edge is named", async ({ page }) => {
    await expect(root(page)).toHaveCount(1);
    await expect(algorithm(page).getByRole("radio")).toHaveCount(2);
    await expect(radio(page, "Layered")).toHaveCount(1);
    await expect(radio(page, "Tree")).toHaveCount(1);
    for (const element of await part(page, "node").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(node(page, "quality")).toHaveAccessibleName("Quality report");
    await expect(
        page.getByTestId("stage").getByRole("group", {
            name: "Join to Enrich",
            exact: true,
        }),
    ).toHaveCount(1);
});
