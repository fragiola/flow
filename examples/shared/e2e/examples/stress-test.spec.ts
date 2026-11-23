import { expect, type Page, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { dragBy, middle, viewportOf } from "./helpers";

// The stress-test example: a generated flow of 1,000 nodes by default (a seeded grid of 120 × 40
// nodes, "Node 1" = `n1` …, joined into one tree: `count - 1` edges), 5,000, 10,000 or 20,000 on
// the "Size" picker, with `onlyRenderVisible`. The readout (`data-testid="readout"`) carries the
// size (`data-size`), the nodes and edges in the DOM (`data-dom-nodes`, `data-dom-edges`, read a
// few times a second), the frame time (`data-frame-ms`) and the time the last size and shuffle
// took to draw (`data-render-ms`, `data-shuffle-ms`, "–" until then). Each node prints its place
// (`data-position="x, y"`). At 10,000 nodes the grid has 71 columns: `n145` is the third node of
// the third row, in view at zoom 1.

test.beforeEach(async ({ page }) => {
    await openExample(page, "stress-test");
});

const stage = (page: Page) => page.getByTestId("stage");
const readout = (page: Page) => stage(page).getByTestId("readout");
const sizePicker = (page: Page) =>
    stage(page).getByRole("combobox", { name: "Size", exact: true });

/** Switches the size and waits for the new flow to be drawn. */
async function showSize(page: Page, size: number) {
    await sizePicker(page).selectOption(String(size));
    await expect(readout(page)).toHaveAttribute("data-size", String(size));
    await expect(readout(page)).not.toHaveAttribute("data-render-ms", "–");
}

/** The nodes in the DOM: as many as the readout says, once it has read them. */
async function domNodes(page: Page) {
    await expect
        .poll(async () => {
            const count = await part(page, "node").count();
            const said = await readout(page).getAttribute("data-dom-nodes");
            return count > 0 && String(count) === said;
        })
        .toBe(true);
    return part(page, "node").count();
}

/** A node's place, as it prints it. */
async function positionOf(page: Page, id: string) {
    const value = await node(page, id).getAttribute("data-position");
    const [x, y] = (value ?? "").split(", ").map(Number);
    return { x: x ?? Number.NaN, y: y ?? Number.NaN };
}

test("1,000 nodes by default, only those in view in the DOM", async ({
    page,
}) => {
    await expect(sizePicker(page)).toHaveValue("1000");
    await expect(readout(page)).toHaveAttribute("data-size", "1000");
    await expect(readout(page)).toHaveAttribute("data-edges", "999");
    const count = await domNodes(page);
    expect(count).toBeLessThan(200);
    await expect(node(page, "n1")).toHaveAccessibleName("Node 1");
    await expect(readout(page)).toHaveAttribute("data-frame-ms", /^\d+\.\d$/);
    await expect(readout(page)).toHaveAttribute("data-render-ms", /^\d+\.\d$/);
});

test.describe("at 10,000 nodes", () => {
    // generating and switching 10,000 nodes takes longer than a usual test
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await showSize(page, 10_000);
    });

    test("the DOM holds only the visible nodes, as the readout says, also zoomed out", async ({
        page,
    }) => {
        await expect(readout(page)).toHaveAttribute("data-edges", "9999");
        const count = await domNodes(page);
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(200);
        expect(await part(page, "edge").count()).toBeLessThan(400);
        await expect(node(page, "n145")).toHaveCount(1);
        // the last node is far out of view
        await expect(node(page, "n10000")).toHaveCount(0);

        // zoomed out, more nodes are in view, still far fewer than the flow's
        const before = await viewportOf(page);
        const at = await middle(node(page, "n145"));
        await page.mouse.move(at.x, at.y);
        for (let step = 0; step < 4; step += 1) {
            await page.mouse.wheel(0, 200);
        }
        await expect
            .poll(async () => (await viewportOf(page)).zoom)
            .toBeLessThan(before.zoom * 0.6);
        await expect
            .poll(async () => (await domNodes(page)) > count)
            .toBe(true);
        expect(await domNodes(page)).toBeLessThan(2_500);
    });

    test("a node drag completes: the node moves and keeps its place", async ({
        page,
    }) => {
        const before = await positionOf(page, "n145");
        const { zoom } = await viewportOf(page);
        await dragBy(page, node(page, "n145"), 90, 50);
        await expect(node(page, "n145")).not.toHaveAttribute("data-dragging");
        const after = await positionOf(page, "n145");
        expect(Math.round(after.x - before.x)).toBe(Math.round(90 / zoom));
        expect(Math.round(after.y - before.y)).toBe(Math.round(50 / zoom));
        // still there after the readout's next reads
        await domNodes(page);
        expect(await positionOf(page, "n145")).toEqual(after);
    });

    test("Shuffle moves every node in view", async ({ page }) => {
        await domNodes(page);
        const ids = await part(page, "node").evaluateAll((elements) =>
            elements.map((element) => element.getAttribute("data-flow-id")),
        );
        const before = new Map<string, string | null>();
        for (const id of ids) {
            if (id)
                before.set(
                    id,
                    await node(page, id).getAttribute("data-position"),
                );
        }
        await stage(page)
            .getByRole("button", { name: "Shuffle", exact: true })
            .click();
        await expect(readout(page)).not.toHaveAttribute("data-shuffle-ms", "–");
        let compared = 0;
        for (const [id, position] of before) {
            if ((await node(page, id).count()) === 0) continue;
            await expect(node(page, id)).not.toHaveAttribute(
                "data-position",
                position ?? "",
            );
            compared++;
        }
        // a node still drawn after the shuffle was compared: the loop ran
        expect(compared).toBeGreaterThan(0);
    });
});

test("Shuffle at 1,000 nodes moves the nodes and says how long it took", async ({
    page,
}) => {
    const before = await node(page, "n1").getAttribute("data-position");
    await stage(page)
        .getByRole("button", { name: "Shuffle", exact: true })
        .click();
    await expect(readout(page)).toHaveAttribute("data-shuffle-ms", /^\d+\.\d$/);
    await expect(node(page, "n1")).not.toHaveAttribute(
        "data-position",
        before ?? "",
    );
});

test("every control, node and edge is named", async ({ page }) => {
    await expect(
        page.getByRole("group", { name: "Stress test", exact: true }),
    ).toHaveCount(1);
    await expect(sizePicker(page)).toHaveCount(1);
    await expect(sizePicker(page).getByRole("option")).toHaveText([
        "1,000 nodes",
        "5,000 nodes",
        "10,000 nodes",
        "20,000 nodes",
    ]);
    await expect(
        stage(page).getByRole("button", { name: "Shuffle", exact: true }),
    ).toHaveCount(1);
    await expect(readout(page)).toHaveAccessibleName("Readout");
    // the loops below check something: the nodes and edges in view are drawn
    await expect(part(page, "node").first()).toBeVisible();
    await expect(part(page, "edge").first()).toBeAttached();
    for (const element of await part(page, "node").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(
        stage(page).getByRole("group", {
            name: "Node 1 to Node 2",
            exact: true,
        }),
    ).toHaveCount(1);
});
