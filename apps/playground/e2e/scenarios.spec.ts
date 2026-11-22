import { expect, test } from "@playwright/test";
import { center } from "./helpers";

// Scenarios are dev-only entries of the playground; the flow's gestures themselves are covered by
// the fixture's specs.

test("lists the scenarios by area, and opens one from the sidebar", async ({
    page,
}) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Playground" });
    await expect(nav.getByRole("heading", { name: "Scenarios" })).toBeVisible();
    await nav.getByRole("link", { name: "Every feature" }).click();
    await expect(page).toHaveURL(/\?scenario=gestures%2Fevery-feature$/);
    await expect(
        page.getByRole("complementary", { name: "Inspector" }),
    ).toBeVisible();
});

test("500 nodes: a drag re-renders the moved node only", async ({ page }) => {
    await page.goto("/?scenario=performance/five-hundred-nodes");
    const nodes = page.locator('[data-flow-part="node"]');
    await expect(nodes).toHaveCount(500);
    await expect(
        page.locator('[data-flow-part="node"]:not([data-measured])'),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "reset counter" }).click();
    await expect(page.getByTestId("renders")).toHaveText("0");
    const first = page.locator('[data-flow-part="node"][data-flow-id="n0"]');
    const from = await center(first);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 30, { steps: 10 });
    await page.mouse.up();
    await expect(first).toHaveAttribute("data-selected", "");
    // one render per drag step and the selection, for this node alone: never the 500
    const renders = Number(await page.getByTestId("renders").textContent());
    expect(renders).toBeGreaterThan(0);
    expect(renders).toBeLessThan(40);
    // the controlled state followed the drag
    await expect(
        page
            .getByRole("complementary", { name: "Inspector" })
            .getByTestId("inspector-selection"),
    ).toHaveText("n0");
});

test("500 nodes: only the visible nodes render when asked", async ({
    page,
}) => {
    await page.goto("/?scenario=performance/five-hundred-nodes");
    await expect(page.locator('[data-flow-part="node"]')).toHaveCount(500);
    await page.getByLabel("only render visible").check();
    // the flow fits every node, so zoom in until some leave the view
    const root = page.locator('[data-flow-part="root"]');
    const box = await root.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 100, (box?.y ?? 0) + 100);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -400);
    await expect
        .poll(() => page.locator('[data-flow-part="node"]').count())
        .toBeLessThan(500);
});

test("the commands scenario logs what the model runs, and the inspector follows", async ({
    page,
}) => {
    await page.goto("/?scenario=api/commands");
    const log = page.getByTestId("command-name");
    await page.getByRole("button", { name: "node.add" }).click();
    await expect(log.first()).toHaveText("node.add");
    await expect(page.getByTestId("inspector-json")).toContainText(
        '"id": "n1"',
    );
    await page.getByRole("button", { name: "edge.add a→b" }).click();
    await expect(page.locator('[data-flow-part="edge"]')).toHaveCount(1);
    await page.getByRole("button", { name: "selection.set a, b" }).click();
    await expect(page.getByTestId("inspector-selection")).toHaveText("a, b");
    await page.getByRole("button", { name: "selection.remove" }).click();
    await expect(log.first()).toHaveText("selection.remove");
    await expect(page.locator('[data-flow-part="edge"]')).toHaveCount(0);
});

for (const [id, count] of [
    ["gestures/viewport-options", 12],
    ["gestures/click-to-connect-and-drag-handles", 4],
    ["gestures/origin-extent-and-z-order", 4],
    ["gestures/keyboard-and-toolbars", 4],
    ["api/graph-and-geometry-helpers", 6],
    ["gestures/interaction-and-events", 4],
] as const) {
    test(`${id} renders its flow without an error`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(`/?scenario=${id}`);
        await expect(page.locator('[data-flow-part="node"]')).toHaveCount(
            count,
        );
        await expect(
            page.locator('[data-flow-part="node"]:not([data-measured])'),
        ).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}

test("the helpers scenario lists a node's neighbours and what it overlaps", async ({
    page,
}) => {
    await page.goto("/?scenario=api/graph-and-geometry-helpers");
    await expect(
        page.locator('[data-flow-part="node"]:not([data-measured])'),
    ).toHaveCount(0);
    const store = page.locator('[data-flow-part="node"][data-flow-id="store"]');
    await store.click();
    await expect(page.getByTestId("helper-selected")).toHaveText("Store");
    await expect(page.getByTestId("incomers")).toHaveText("Parse, Validate");
    await expect(page.getByTestId("outgoers")).toHaveText("Notify");
    await expect(page.getByTestId("intersecting")).toHaveText("none");
    // drag the sticky note over Store: they overlap
    const sticky = page.locator(
        '[data-flow-part="node"][data-flow-id="sticky"]',
    );
    const from = await center(sticky);
    const to = await center(store);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x + 10, to.y + 10, { steps: 10 });
    await page.mouse.up();
    await store.click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId("helper-selected")).toHaveText("Store");
    await expect(page.getByTestId("intersecting")).toHaveText("Sticky");
    // every edge is a simple bezier: one curve
    for (const path of await page
        .locator('[data-flow-part="edge-path"]')
        .all()) {
        expect(await path.getAttribute("d")).toMatch(/^M[^C]+C[^C]+$/);
    }
});

test("the interaction scenario logs the root's callbacks", async ({ page }) => {
    await page.goto("/?scenario=gestures/interaction-and-events");
    await expect(
        page.locator('[data-flow-part="node"]:not([data-measured])'),
    ).toHaveCount(0);
    const log = page.getByTestId("scenario-log");
    await expect(log).toContainText("ready");
    await page.locator('[data-flow-part="node"][data-flow-id="a"]').click();
    await expect(log.locator("li").first()).toContainText(
        'node-click {"nodeId":"a"',
    );
});
