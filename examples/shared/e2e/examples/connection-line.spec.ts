import { expect, type Page, test } from "@playwright/test";
import { handle, node, openExample, part } from "../helpers";
import { expectNamedHandles, middle } from "./helpers";

// The connection-line example: `Flow.ConnectionLine`'s children draw the app's own line (an elbow,
// `data-testid="custom-line"`) inside the connection line, which says whether the target under it
// takes the edge (`data-valid` / `data-invalid`; a locked node refuses). With several nodes
// selected, a drag from one of their handles draws a line from each of the others
// (`data-testid="extra-line"`), and the drop connects them all; a drag from a node alone adds one.

test.beforeEach(async ({ page }) => {
    await openExample(page, "connection-line");
});

/** An edge by its accessible name (`<source> to <target>`). */
const named = (page: Page, name: string) =>
    page.getByTestId("stage").getByRole("group", { name, exact: true });

const stage = (page: Page) => page.getByTestId("stage");

/** Presses a node's source handle and moves onto another node's target handle, held. */
async function holdOver(page: Page, from: string, to: string) {
    const start = await middle(handle(page, from, "source"));
    const end = await middle(handle(page, to, "target"));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, {
        steps: 5,
    });
    await page.mouse.move(end.x, end.y, { steps: 5 });
}

/** Clicks a node's middle, with Shift held for a second one. */
async function select(page: Page, id: string, add = false) {
    const point = await middle(node(page, id));
    if (add) await page.keyboard.down("Shift");
    await page.mouse.click(point.x, point.y);
    if (add) await page.keyboard.up("Shift");
    await expect(node(page, id)).toHaveAttribute("data-selected", "");
}

test("the custom line appears during a drag and shows the target's validity", async ({
    page,
}) => {
    await expect(part(page, "connection-line")).toHaveCount(0);
    await holdOver(page, "sensor", "monitor");
    const line = part(page, "connection-line");
    await expect(line.getByTestId("custom-line")).toHaveCount(1);
    // the app's own drawing replaces the default path
    await expect(
        line.locator('[data-flow-part="connection-path"]'),
    ).toHaveCount(0);
    await expect(line).toHaveAttribute("data-valid", "");
    const stroke = () =>
        line
            .getByTestId("custom-line")
            .evaluate((element) => getComputedStyle(element).stroke);
    const valid = await stroke();
    // over the locked node, refused
    const locked = await middle(handle(page, "archive", "target"));
    await page.mouse.move(locked.x, locked.y, { steps: 5 });
    await expect(line).toHaveAttribute("data-invalid", "");
    await expect(line).not.toHaveAttribute("data-valid");
    // the line's own colour follows: the valid colour is not the refused one
    expect(await stroke()).not.toBe(valid);
    await page.mouse.up();
    await expect(part(page, "connection-line")).toHaveCount(0);
    await expect(part(page, "edge")).toHaveCount(1);
    await expect(stage(page).getByTestId("outcome")).toContainText("Refused");
});

test("a drag from a node alone adds one edge", async ({ page }) => {
    await expect(part(page, "edge")).toHaveCount(1);
    await holdOver(page, "sensor", "monitor");
    await expect(stage(page).getByTestId("extra-line")).toHaveCount(0);
    await page.mouse.up();
    await expect(part(page, "edge")).toHaveCount(2);
    await expect(named(page, "Sensor to Monitor")).toHaveCount(1);
});

test("with several nodes selected, a drag from one draws a line from each and connects them all", async ({
    page,
}) => {
    await select(page, "camera");
    await select(page, "microphone", true);
    await select(page, "sensor", true);
    await holdOver(page, "camera", "monitor");
    const extra = stage(page).getByTestId("extra-line");
    await expect(extra).toHaveCount(2);
    await expect(extra.nth(0)).toHaveAttribute("data-source", "microphone");
    await expect(extra.nth(1)).toHaveAttribute("data-source", "sensor");
    await expect(part(page, "connection-line")).toHaveAttribute(
        "data-valid",
        "",
    );
    await page.mouse.up();
    await expect(part(page, "edge")).toHaveCount(4);
    for (const name of [
        "Camera to Monitor",
        "Microphone to Monitor",
        "Sensor to Monitor",
    ]) {
        await expect(named(page, name)).toHaveCount(1);
    }
    await expect(stage(page).getByTestId("outcome")).toContainText(
        "Connected Camera, Microphone, Sensor to Monitor",
    );
});

test("a drag from a node outside the selection adds just its own edge", async ({
    page,
}) => {
    await select(page, "camera");
    await select(page, "microphone", true);
    await holdOver(page, "sensor", "recorder");
    await expect(stage(page).getByTestId("extra-line")).toHaveCount(0);
    await page.mouse.up();
    await expect(part(page, "edge")).toHaveCount(2);
    await expect(named(page, "Sensor to Recorder")).toHaveCount(1);
});

test("every node, edge and handle a keyboard reaches is named", async ({
    page,
}) => {
    await expectNamedHandles(page, 12);
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(6);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(named(page, "Camera to Recorder")).toHaveCount(1);
});
