import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part } from "../helpers";
import { boxOf, dragFrom, middle, near, viewportOf } from "./helpers";

// The whiteboard example: a toolbar of tools (toggle buttons, the active one pressed, its name on
// the root as `data-tool`). Rectangle adds a node of the dragged box; Freehand adds a stroke node
// with its path; the eraser removes what it wipes over (a node with its edges, or an edge alone);
// the lasso selects the nodes inside the shape it draws. With a drawing tool active, a drag on
// the pane draws and never pans.

test.beforeEach(async ({ page }) => {
    await openExample(page, "whiteboard");
});

type Point = { x: number; y: number };

const tools = (page: Page) =>
    page
        .getByTestId("stage")
        .getByRole("toolbar", { name: "Whiteboard tools" });

async function choose(page: Page, name: string, tool: string) {
    const button = tools(page).getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(part(page, "root")).toHaveAttribute("data-tool", tool);
}

/** An empty spot of the board: below the nodes, near the root's bottom-left corner. */
async function emptySpot(page: Page): Promise<Point> {
    const root = await boxOf(part(page, "root"));
    return { x: root.x + 40, y: root.y + root.height - 130 };
}

/** Presses at the first point, moves through the others (in steps), and releases. */
async function trace(page: Page, points: Point[]) {
    const [first, ...rest] = points as [Point, ...Point[]];
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const point of rest) {
        await page.mouse.move(point.x, point.y, { steps: 8 });
    }
    await page.mouse.up();
}

test("the tools are a toolbar of named toggle buttons, Select pressed at first", async ({
    page,
}) => {
    for (const name of ["Select", "Rectangle", "Freehand", "Eraser", "Lasso"]) {
        await expect(
            tools(page).getByRole("button", { name, exact: true }),
        ).toHaveAttribute("aria-pressed", name === "Select" ? "true" : "false");
    }
    await expect(part(page, "root")).toHaveAttribute("data-tool", "select");
    await choose(page, "Lasso", "lasso");
    await expect(
        tools(page).getByRole("button", { name: "Select", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
});

test("Rectangle: a drag on the board adds a rectangle of its size, without panning", async ({
    page,
}) => {
    await choose(page, "Rectangle", "rectangle");
    await expect(part(page, "node")).toHaveCount(5);
    const viewport = await viewportOf(page);
    const start = await emptySpot(page);
    await dragFrom(page, start, 120, 80);
    await expect(part(page, "node")).toHaveCount(6);
    const added = page
        .getByTestId("stage")
        .getByRole("group", { name: "Rectangle 1", exact: true });
    await expect(added).toHaveAttribute("data-flow-part", "node");
    const box = await boxOf(added);
    near(box.x, start.x, 3);
    near(box.y, start.y, 3);
    near(box.width, 120, 3);
    near(box.height, 80, 3);
    expect(await viewportOf(page)).toEqual(viewport);
    await expect(page.getByTestId("stage").getByRole("status")).toHaveText(
        "Rectangle 1 drawn.",
    );
});

test("Freehand: a drawn line becomes a stroke node holding its path", async ({
    page,
}) => {
    await choose(page, "Freehand", "freehand");
    const start = await emptySpot(page);
    const points = [
        start,
        { x: start.x + 40, y: start.y - 30 },
        { x: start.x + 80, y: start.y + 20 },
        { x: start.x + 120, y: start.y - 20 },
    ];
    await trace(page, points);
    await expect(part(page, "node")).toHaveCount(6);
    const stroke = page
        .getByTestId("stage")
        .getByRole("group", { name: "Stroke 1", exact: true });
    await expect(stroke).toHaveAttribute("aria-roledescription", "stroke");
    await expect(stroke.locator("path")).toHaveAttribute("d", /^M[\d.]+,/);
    // the node's box is the stroke's: it holds every point drawn (its margin aside)
    const box = await boxOf(stroke);
    for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(box.x);
        expect(point.x).toBeLessThanOrEqual(box.x + box.width);
        expect(point.y).toBeGreaterThanOrEqual(box.y);
        expect(point.y).toBeLessThanOrEqual(box.y + box.height);
    }
    near(box.width, 120, 12);
    // the drawn path reaches across it
    const path = await boxOf(stroke.locator("path"));
    near(path.width, box.width, 14);
});

test("Eraser: a wipe over a node removes it and its edges; over an edge, the edge alone", async ({
    page,
}) => {
    await choose(page, "Eraser", "eraser");
    await expect(part(page, "edge")).toHaveCount(2);
    // across the middle of the edge between Ideas and Sketch, clear of both
    const line = await middle(edge(page, "ideas-sketch"));
    await trace(page, [
        { x: line.x, y: line.y - 25 },
        { x: line.x, y: line.y + 25 },
    ]);
    await expect(edge(page, "ideas-sketch")).toHaveCount(0);
    await expect(part(page, "edge")).toHaveCount(1);
    await expect(part(page, "node")).toHaveCount(5);

    // down through Review: marked while the wipe goes on, removed with its edge when it ends
    const review = await boxOf(node(page, "review"));
    const x = review.x + review.width / 2;
    await page.mouse.move(x, review.y - 30);
    await page.mouse.down();
    await page.mouse.move(x, review.y + review.height + 30, { steps: 10 });
    await expect(node(page, "review")).toHaveAttribute("data-erasing", "");
    await page.mouse.up();
    await expect(node(page, "review")).toHaveCount(0);
    await expect(edge(page, "sketch-review")).toHaveCount(0);
    await expect(part(page, "node")).toHaveCount(4);
    await expect(part(page, "edge")).toHaveCount(0);
    await expect(page.getByTestId("stage").getByRole("status")).toHaveText(
        "Erased 1 item.",
    );
});

test("Lasso: a shape drawn around two nodes selects exactly them", async ({
    page,
}) => {
    await choose(page, "Lasso", "lasso");
    const ideas = await boxOf(node(page, "ideas"));
    const sketch = await boxOf(node(page, "sketch"));
    const left = ideas.x - 20;
    const top = Math.min(ideas.y, sketch.y) - 20;
    const right = sketch.x + sketch.width + 20;
    const bottom =
        Math.max(ideas.y + ideas.height, sketch.y + sketch.height) + 20;
    await trace(page, [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: top + 5 },
    ]);
    await expect(node(page, "ideas")).toHaveAttribute("data-selected", "");
    await expect(node(page, "sketch")).toHaveAttribute("data-selected", "");
    await expect(
        part(page, "node").and(page.locator("[data-selected]")),
    ).toHaveCount(2);
    await expect(page.getByTestId("stage").getByRole("status")).toHaveText(
        "2 nodes selected.",
    );
});

test("with a drawing tool, a drag on the pane never pans it; with Select it does", async ({
    page,
}) => {
    const start = await emptySpot(page);
    for (const [name, tool] of [
        ["Freehand", "freehand"],
        ["Eraser", "eraser"],
        ["Lasso", "lasso"],
    ] as const) {
        await choose(page, name, tool);
        const viewport = await viewportOf(page);
        await dragFrom(page, start, 60, -40);
        expect(await viewportOf(page)).toEqual(viewport);
    }
    await choose(page, "Select", "select");
    const before = await viewportOf(page);
    await dragFrom(page, start, 60, -40);
    await expect
        .poll(async () => (await viewportOf(page)).x)
        .not.toBe(before.x);
});

test("every node, edge and tool is named", async ({ page }) => {
    const stage = page.getByTestId("stage");
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(5);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const name of ["Ideas to Sketch", "Sketch to Review"]) {
        await expect(
            stage.getByRole("group", { name, exact: true }),
        ).toHaveCount(1);
    }
    await expect(tools(page).getByRole("button")).toHaveCount(5);
    for (const element of await tools(page).getByRole("button").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
});
