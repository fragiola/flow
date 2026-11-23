import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample } from "../helpers";
import { expectNamedHandles, middle, press } from "./helpers";

// The shapes example: each node draws its shape (`data-shape` on its turned content), its toolbar
// picks another, the knob above it turns it (the angle in its data: `data-angle`, and the knob's
// slider value), its handles follow the turn, and its label is edited in place.

test.beforeEach(async ({ page }) => {
    await openExample(page, "shapes");
});

/** A node's turned content: it carries the node's shape and angle. */
const content = (page: Page, id: string) =>
    node(page, id).locator("[data-angle]");

test("dragging the knob turns the node: the angle is stored, and its handles turn with it", async ({
    page,
}) => {
    const check = node(page, "check");
    const knob = check.getByRole("slider", { name: "Rotate In stock?" });
    await expect(content(page, "check")).toHaveAttribute("data-angle", "0");
    await expect(knob).toHaveAttribute("aria-valuenow", "0");
    const centre = await middle(content(page, "check"));
    const from = await middle(knob);
    // a quarter turn clockwise: from above the centre to its right
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 70, centre.y - 70, { steps: 5 });
    await page.mouse.move(centre.x + 100, centre.y, { steps: 5 });
    await page.mouse.up();
    await expect(content(page, "check")).toHaveAttribute("data-angle", "90");
    await expect(knob).toHaveAttribute("aria-valuenow", "90");
    // the input handle, drawn on the top, now stands on the right and faces it
    const input = check.locator(
        '[data-flow-part="handle"][data-handle-type="target"]',
    );
    await expect(input).toHaveAttribute("data-side", "right");
    const point = await middle(input);
    expect(point.x).toBeGreaterThan(centre.x + 20);
    expect(Math.abs(point.y - centre.y)).toBeLessThan(3);
    // the edges still reach it
    await expect(
        edge(page, "read-check").locator('[data-flow-part="edge-path"]').last(),
    ).toHaveAttribute("d", /^M/);
    // the node is still where it was: the knob turns, it never drags
    const after = await middle(content(page, "check"));
    expect(Math.abs(after.x - centre.x)).toBeLessThan(1);
    expect(Math.abs(after.y - centre.y)).toBeLessThan(1);
});

test("the knob turns by the arrows too, a step at a time", async ({ page }) => {
    const knob = node(page, "check").getByRole("slider", {
        name: "Rotate In stock?",
    });
    await knob.focus();
    await page.keyboard.press("ArrowRight");
    await expect(knob).toHaveAttribute("aria-valuenow", "15");
    await expect(content(page, "check")).toHaveAttribute("data-angle", "15");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(knob).toHaveAttribute("aria-valuenow", "345");
    await page.keyboard.press("Home");
    await expect(content(page, "check")).toHaveAttribute("data-angle", "0");
    // the arrows turned it, never moved it: the node keeps its place in the document
    await expect(knob).toBeFocused();
});

test("the toolbar's picker changes the node's shape", async ({ page }) => {
    const pick = node(page, "pick");
    await expect(content(page, "pick")).toHaveAttribute(
        "data-shape",
        "rectangle",
    );
    const outline = content(page, "pick").locator("svg path");
    const before = await outline.getAttribute("d");
    await press(page, pick);
    await expect(pick).toHaveAttribute("data-selected", "");
    const picker = page.getByRole("toolbar", { name: "Shape of Pick items" });
    await expect(picker).toBeVisible();
    await expect(
        picker.getByRole("button", { name: "Rectangle", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "Diamond" }).click();
    await expect(content(page, "pick")).toHaveAttribute(
        "data-shape",
        "diamond",
    );
    await expect(outline).not.toHaveAttribute("d", before ?? "");
    await expect(
        picker.getByRole("button", { name: "Diamond" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(pick).toHaveAccessibleName("Pick items (Diamond)");
});

test("a label is edited in place: Enter keeps it, Escape drops it", async ({
    page,
}) => {
    const ship = node(page, "ship");
    await ship.dblclick();
    const field = ship.getByRole("textbox", { name: "Label of Ship" });
    await expect(field).toBeFocused();
    await field.fill("Deliver");
    await field.press("Enter");
    await expect(field).toHaveCount(0);
    await expect(ship).toHaveAccessibleName("Deliver (Hexagon)");
    // from the toolbar's pencil, then dropped
    await page
        .getByRole("toolbar", { name: "Shape of Deliver" })
        .getByRole("button", { name: "Edit label" })
        .click();
    const again = ship.getByRole("textbox", { name: "Label of Deliver" });
    await expect(again).toBeFocused();
    await again.fill("Nothing");
    await again.press("Escape");
    await expect(again).toHaveCount(0);
    await expect(ship).toHaveAccessibleName("Deliver (Hexagon)");
    // the next edit, after a drop, is kept on leaving the field
    await ship.dblclick();
    const third = ship.getByRole("textbox", { name: "Label of Deliver" });
    await expect(third).toBeFocused();
    await third.fill("Send");
    await third.blur();
    await expect(third).toHaveCount(0);
    await expect(ship).toHaveAccessibleName("Send (Hexagon)");
});

test("every node, handle, knob and picker a keyboard reaches is named", async ({
    page,
}) => {
    await expectNamedHandles(page, 14);
    const nodes = page.getByTestId("stage").locator('[data-flow-part="node"]');
    await expect(nodes).toHaveCount(7);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(
        node(page, "check").getByRole("slider", { name: "Rotate In stock?" }),
    ).toBeVisible();
    const picker = page.getByRole("toolbar", { name: "Shape of In stock?" });
    await expect(picker.getByRole("button")).toHaveCount(8);
    for (const button of await picker.getByRole("button").all()) {
        await expect(button).toHaveAccessibleName(/\S/);
    }
});
