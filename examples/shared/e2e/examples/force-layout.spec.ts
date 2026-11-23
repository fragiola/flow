import { expect, type Locator, type Page, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { dragFrom, middle, near, rendered } from "./helpers";

// The force-layout example: a network of 14 nodes ("Web app" = `web`, "Gateway", "API", "Queue",
// …) and 17 edges (`<source>-<target>`, drawn from centre to centre) placed by a d3-force
// simulation. The root (the group "Force layout") carries `data-simulation`, "running" while the
// simulation moves the nodes and "settled" once it has cooled; each node prints its place
// (`data-position="x, y"`) and, pinned by a drag, carries `data-pinned`. "Restart" releases every
// pin and runs the simulation again.

test.beforeEach(async ({ page }) => {
    await openExample(page, "force-layout");
});

const root = (page: Page) =>
    page.getByRole("group", { name: "Force layout", exact: true });
const restartButton = (page: Page) =>
    root(page).getByRole("button", { name: "Restart", exact: true });

/** Waits for the simulation to cool down (it runs a few seconds), then for it to be drawn. */
async function settled(page: Page) {
    await expect(root(page)).toHaveAttribute("data-simulation", "settled", {
        timeout: 15_000,
    });
    await rendered(page);
}

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

/** Expects no two nodes' boxes on screen to overlap (beyond a pixel of rounding). */
async function expectApart(page: Page) {
    const boxes = await part(page, "node").evaluateAll((elements) =>
        elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return {
                id: element.getAttribute("data-flow-id"),
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
            };
        }),
    );
    for (const [index, a] of boxes.entries()) {
        for (const b of boxes.slice(index + 1)) {
            const overlap = Math.min(
                Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
                Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
            );
            expect(overlap, `${a.id} and ${b.id}`).toBeLessThanOrEqual(1.5);
        }
    }
}

/**
 * Presses `target` and drags it half-way towards the stage's centre, held (not released): the
 * point the pointer is at.
 */
async function holdTowardsCentre(page: Page, target: Locator) {
    const from = await middle(target);
    const stage = await middle(page.getByTestId("stage"));
    const dx = Math.round((stage.x - from.x) / 2);
    const dy = Math.round((stage.y - from.y) / 2) + 30;
    await dragFrom(page, from, dx, dy, { release: false });
    return { x: from.x + dx, y: from.y + dy };
}

test("opens running, settles with no two nodes overlapping", async ({
    page,
}) => {
    // the simulation runs a few seconds from the start
    await expect(root(page)).toHaveAttribute("data-simulation", "running");
    await expect(part(page, "node")).toHaveCount(14);
    await expect(part(page, "edge")).toHaveCount(17);
    await settled(page);
    await expect(root(page).locator("[data-pinned]")).toHaveCount(0);
    await expect(root(page).getByRole("status")).toHaveText("Settled");
    await expectApart(page);
});

test("a dragged node is pinned where it is dropped, and the others make room", async ({
    page,
}) => {
    await settled(page);
    const before = await positions(page);
    const mailer = node(page, "mailer");

    const held = await holdTowardsCentre(page, mailer);
    // dragged: pinned in the simulation, which runs again
    await expect(mailer).toHaveAttribute("data-pinned", "");
    await expect(root(page)).toHaveAttribute("data-simulation", "running");
    // the others react while it is held
    await expect
        .poll(async () => {
            const now = await positions(page);
            return Object.keys(now).some(
                (id) => id !== "mailer" && now[id] !== before[id],
            );
        })
        .toBe(true);
    // a little further, then the drop
    const drop = { x: held.x + 20, y: held.y + 10 };
    await page.mouse.move(drop.x, drop.y, { steps: 4 });
    await page.mouse.up();

    const dropped = await middle(mailer);
    near(dropped.x, drop.x, 3);
    near(dropped.y, drop.y, 3);
    const place = await mailer.getAttribute("data-position");
    expect(place).not.toBe(before.mailer);

    await settled(page);
    // still pinned, still where it was dropped
    await expect(mailer).toHaveAttribute("data-pinned", "");
    await expect(mailer).toHaveAttribute("data-position", place ?? "");
    const after = await middle(mailer);
    near(after.x, drop.x, 3);
    near(after.y, drop.y, 3);
    await expect(root(page).locator("[data-pinned]")).toHaveCount(1);
    await expectApart(page);
});

test("Restart releases every pin and runs the simulation again", async ({
    page,
}) => {
    await settled(page);
    const reports = node(page, "reports");
    await holdTowardsCentre(page, reports);
    await page.mouse.up();
    await settled(page);
    await expect(reports).toHaveAttribute("data-pinned", "");

    await restartButton(page).click();
    await expect(root(page)).toHaveAttribute("data-simulation", "running");
    await expect(root(page).locator("[data-pinned]")).toHaveCount(0);
    await expect(root(page).getByRole("status")).toHaveText("Simulating…");
    await settled(page);
    await expect(root(page).locator("[data-pinned]")).toHaveCount(0);
    await expectApart(page);
});

test("every control, node and edge is named", async ({ page }) => {
    await expect(root(page)).toHaveCount(1);
    await expect(restartButton(page)).toHaveCount(1);
    for (const element of await part(page, "node").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(node(page, "web")).toHaveAccessibleName("Web app");
    await expect(
        page.getByTestId("stage").getByRole("group", {
            name: "Gateway to API",
            exact: true,
        }),
    ).toHaveCount(1);
});
