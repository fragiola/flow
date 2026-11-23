import { expect, type Page, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { dragBy, viewportOf } from "./helpers";

// The helper-lines example: a node dragged alone shows a guide (`data-testid="guide"`, the app's
// own element, `data-axis="x"` a vertical line at `data-at`, `data-axis="y"` a horizontal one)
// where its edges or centre line up with another node's, snaps onto it within a few flow units
// (the node prints its position, `data-testid="position"`), and the drop clears the guides and
// keeps the snapped position. Draft is at 0, 0 (160 × 60), Review at 280, 110 (120 × 80), Publish
// at 36, 250 (180 × 60).

test.beforeEach(async ({ page }) => {
    await openExample(page, "helper-lines");
});

const guides = (page: Page) => page.getByTestId("stage").getByTestId("guide");

/** The node's position in flow units, as the example prints it. */
const position = (page: Page, id: string) =>
    node(page, id).getByTestId("position");

/** Drags a node by `dx`, `dy` flow units, holding it there. */
async function hold(page: Page, id: string, dx: number, dy: number) {
    const { zoom } = await viewportOf(page);
    await dragBy(page, node(page, id), dx * zoom, dy * zoom, {
        release: false,
    });
    await expect(node(page, id)).toHaveAttribute("data-dragging", "");
}

test("a node dragged near another's left edge shows a vertical guide and snaps onto it", async ({
    page,
}) => {
    await expect(guides(page)).toHaveCount(0);
    await expect(position(page, "publish")).toHaveText("36, 250");
    // Publish's left edge, 3 units right of Draft's (0)
    await hold(page, "publish", -33, 0);
    await expect(guides(page)).toHaveCount(1);
    await expect(guides(page)).toHaveAttribute("data-axis", "x");
    await expect(guides(page)).toHaveAttribute("data-at", "0");
    await expect(position(page, "publish")).toHaveText("0, 250");
    await page.mouse.up();
    await expect(node(page, "publish")).not.toHaveAttribute("data-dragging");
    await expect(guides(page)).toHaveCount(0);
    await expect(position(page, "publish")).toHaveText("0, 250");
});

test("a node dragged near another's centre line shows a horizontal guide and snaps onto it", async ({
    page,
}) => {
    // Review's middle (150), moved up to 4 units below Draft's (30)
    await hold(page, "review", 0, -116);
    await expect(guides(page)).toHaveCount(1);
    await expect(guides(page)).toHaveAttribute("data-axis", "y");
    await expect(guides(page)).toHaveAttribute("data-at", "30");
    await expect(position(page, "review")).toHaveText("280, -10");
    await page.mouse.up();
    await expect(node(page, "review")).not.toHaveAttribute("data-dragging");
    await expect(guides(page)).toHaveCount(0);
    await expect(position(page, "review")).toHaveText("280, -10");
});

test("a node dragged far from every line shows no guide", async ({ page }) => {
    await hold(page, "publish", 100, 0);
    await expect(guides(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(node(page, "publish")).not.toHaveAttribute("data-dragging");
    await expect(guides(page)).toHaveCount(0);
});

test("every node and edge a keyboard reaches is named", async ({ page }) => {
    await expect(
        page.getByRole("group", { name: "Helper lines", exact: true }),
    ).toHaveCount(1);
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(3);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    const edges = part(page, "edge");
    await expect(edges).toHaveCount(2);
    for (const element of await edges.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(
        page
            .getByTestId("stage")
            .getByRole("group", { name: "Draft to Review", exact: true }),
    ).toHaveCount(1);
});
