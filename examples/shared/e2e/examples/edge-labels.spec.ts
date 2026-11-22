import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { edge, openExample, part } from "../helpers";
import { boxOf, middle, near, viewportOf } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "edge-labels");
});

test("labels sit on their edges: text, a status, a button", async ({
    page,
}) => {
    await expect(part(page, "edge-label")).toHaveCount(4);
    await expect(page.getByTestId("stage").getByText("on push")).toBeVisible();
    await expect(page.getByTestId("stage").getByText("failing")).toBeVisible();
});

test("the button in a label removes its edge", async ({ page }) => {
    await page
        .getByRole("button", { name: "Remove the edge from lint to deploy" })
        .click();
    await expect(edge(page, "lint-deploy")).toHaveCount(0);
    await expect(part(page, "edge")).toHaveCount(3);
});

/** A point on an edge's stroke, a quarter of its length from the source, on screen. */
async function onStroke(page: Page, edgeId: string) {
    return edge(page, edgeId)
        .locator('[data-flow-part="edge-path"]')
        .last()
        .evaluate((element) => {
            const path = element as SVGPathElement;
            const point = path.getPointAtLength(path.getTotalLength() / 4);
            const matrix = path.getScreenCTM();
            const screen = matrix
                ? new DOMPoint(point.x, point.y).matrixTransform(matrix)
                : { x: Number.NaN, y: Number.NaN };
            return { x: screen.x, y: screen.y };
        });
}

/** An edge's label (it is drawn in the edges' HTML layer, not in the edge's group). */
const label = (page: Page, edgeId: string) =>
    part(page, "edge-label").and(page.locator(`[data-flow-id="${edgeId}"]`));

const actions = (page: Page, name: string) =>
    page.getByRole("toolbar", { name: `${name}: actions` });

test("the selected edge shows its toolbar above its label", async ({
    page,
}) => {
    // build → lint starts selected
    await expect(part(page, "toolbar")).toHaveCount(1);
    const toolbar = actions(page, "build to lint");
    await expect(toolbar).toBeVisible();
    const point = await middle(label(page, "build-lint"));
    const at = await middle(toolbar);
    near(at.x, point.x);
    near(at.y, point.y - 36);
    // a click on another edge's stroke selects it: its toolbar replaces the first
    const stroke = await onStroke(page, "build-test");
    await page.mouse.click(stroke.x, stroke.y);
    await expect(edge(page, "build-test")).toHaveAttribute("data-selected", "");
    await expect(actions(page, "build to test")).toBeVisible();
    await expect(actions(page, "build to lint")).toHaveCount(0);
});

test("the edge toolbar keeps its size at any zoom and stays above its label", async ({
    page,
}) => {
    const toolbar = actions(page, "build to lint");
    const before = await boxOf(toolbar);
    const root = await boxOf(part(page, "root"));
    await page.mouse.move(root.x + root.width - 30, root.y + root.height - 30);
    const zoom = (await viewportOf(page)).zoom;
    await page.mouse.wheel(0, 300);
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeLessThan(zoom);
    await expect(async () => {
        const after = await boxOf(toolbar);
        near(after.width, before.width);
        near(after.height, before.height);
        const point = await middle(label(page, "build-lint"));
        const at = await middle(toolbar);
        near(at.x, point.x);
        near(at.y, point.y - 36);
    }).toPass();
});

test("the edge toolbar's buttons flip a status and remove the edge", async ({
    page,
}) => {
    const toolbar = actions(page, "build to lint");
    await toolbar.getByRole("button", { name: "Mark it passing" }).click();
    await expect(label(page, "build-lint")).toHaveText("passing");
    await expect(
        toolbar.getByRole("button", { name: "Mark it failing" }),
    ).toBeVisible();
    await toolbar.getByRole("button", { name: "Remove it" }).click();
    await expect(edge(page, "build-lint")).toHaveCount(0);
    await expect(part(page, "toolbar")).toHaveCount(0);
});
