import { expect, type Page, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, dragBy, middle, near, viewportOf } from "./helpers";

/** The zoom once the buttons' animation (`duration`) has settled. */
async function settled(page: Page) {
    let last = Number.NaN;
    await expect
        .poll(async () => {
            const { zoom } = await viewportOf(page);
            const still = zoom === last;
            last = zoom;
            return still;
        })
        .toBe(true);
    return viewportOf(page);
}

test.beforeEach(async ({ page }) => {
    await openExample(page, "minimap-and-controls");
});

test("the zoom buttons zoom, and stop at the limits", async ({ page }) => {
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    const before = await viewportOf(page);
    await zoomIn.click();
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeGreaterThan(before.zoom);
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) {
        await zoomIn.click();
        await settled(page);
    }
    await expect(zoomIn).toBeDisabled();
    await expect(zoomIn).toHaveAttribute("data-disabled", "");
    near((await viewportOf(page)).zoom, 2, 0.01);
    await page.getByRole("button", { name: "Fit view" }).click();
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeLessThan(1);
});

test("the lock stops dragging, and pan still works", async ({ page }) => {
    const lock = page.getByRole("button", { name: "Lock the flow" });
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "true");
    await expect(part(page, "root")).not.toHaveAttribute(
        "data-interactive",
        "",
    );
    const paris = node(page, "paris");
    const rome = node(page, "rome");
    const gap = async () => (await boxOf(rome)).x - (await boxOf(paris)).x;
    const before = await gap();
    await dragBy(page, paris, 60, 0);
    near(await gap(), before, 1);
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "false");
});

test("the minimap shows every node, and a drag in it pans the flow", async ({
    page,
}) => {
    await expect(part(page, "minimap-node")).toHaveCount(10);
    const before = await viewportOf(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await settled(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    const zoomed = await settled(page);
    expect(zoomed.zoom).toBeGreaterThan(before.zoom);
    const map = await middle(part(page, "minimap"));
    await page.mouse.move(map.x, map.y);
    await page.mouse.down();
    await page.mouse.move(map.x + 30, map.y + 20, { steps: 6 });
    await page.mouse.up();
    const after = await viewportOf(page);
    expect(after.x).not.toBe(zoomed.x);
});

test("the zoom buttons animate their change", async ({ page }) => {
    const before = (await settled(page)).zoom;
    // the zoom the viewport is drawn at, every frame for half a second after the press
    const sampling = page.getByTestId("stage").evaluate(
        (stage) =>
            new Promise<number[]>((resolve) => {
                const viewport = stage.querySelector(
                    '[data-flow-part="viewport"]',
                );
                const zooms: number[] = [];
                const end = performance.now() + 500;
                const step = () => {
                    if (viewport) {
                        zooms.push(
                            new DOMMatrixReadOnly(
                                getComputedStyle(viewport).transform,
                            ).a,
                        );
                    }
                    if (performance.now() < end) requestAnimationFrame(step);
                    else resolve(zooms);
                };
                requestAnimationFrame(step);
            }),
    );
    await page.getByRole("button", { name: "Zoom in" }).click();
    const zooms = await sampling;
    const after = zooms.at(-1) ?? before;
    near(after, before * 1.2, 0.01);
    // frames between the two zooms: it went there step by step
    const between = zooms.filter(
        (zoom) => zoom > before + 0.001 && zoom < after - 0.001,
    );
    expect(between.length).toBeGreaterThan(1);
});
